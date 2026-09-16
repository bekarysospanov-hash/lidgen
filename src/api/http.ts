// httpApi — тот же интерфейс Api поверх fetch. Пути и методы строго по
// docs/api-contract.md §5. Ответ сервера разбирается теми же zod-схемами,
// что и моковый: не прошло — CONTRACT_VIOLATION, громко, а не тихое undefined
// в половине полей (§6).
import {
  ConfirmOtpInput,
  CreateQuote,
  CreateRequest,
  ErrorEnvelope,
  MasterConfirmCodeInput,
  MasterRequestCodeInput,
  MasterSession,
  OtpSent,
  Photo,
  Quote,
  RequestConfirmed,
  RequestCreated,
  RequestForClient,
  RequestForMaster,
  RequestForMasterListItem,
  ResendOtpInput,
} from '../contract'
import { z } from 'zod'
import { ApiError, validationFailed } from './errors'
import type {
  Api,
  ConfirmOtpInputLike,
  CreateQuoteInputLike,
  CreateRequestInput,
  MasterCodeInputLike,
  MasterConfirmInputLike,
  ResendOtpInputLike,
  UploadPhotoInputLike,
} from './types'

/** База берётся из окружения: моки и прод отличаются переключателем, не кодом. */
const API_BASE = import.meta.env?.VITE_API_BASE ?? ''

/**
 * Потолок ожидания ответа. Без него зависший запрос не становится ничем:
 * промис не разрешается, NETWORK не наступает, кнопка остаётся
 * заблокированной навсегда. Контракт §6 прямо относит таймаут к NETWORK.
 * Пятнадцать секунд — заметно дольше любого нормального ответа и заметно
 * короче терпения человека с телефоном в руке.
 */
export const REQUEST_TIMEOUT_MS = 15_000

type Schema<T> = { parse: (value: unknown) => T; safeParse: (value: unknown) => { success: boolean } }

/** Вход проверяется той же схемой, что и на сервере, — до отправки. */
function parseInput<T>(schema: { safeParse: (value: unknown) => { success: boolean } }, input: unknown): T {
  const result = schema.safeParse(input) as { success: boolean; data?: T; error?: unknown }
  if (!result.success) throw validationFailed(result.error)
  return result.data as T
}

async function readJson(response: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

/** Схема для ответов без тела: разбирать нечего, но call требует схему. */
const PASSTHROUGH: Schema<unknown> = {
  parse: (value: unknown) => value,
  safeParse: () => ({ success: true }),
}

async function call<T>(path: string, init: RequestInit, schema: Schema<T>): Promise<T> {
  // Таймаут накрывает и сам запрос, и чтение тела: зависнуть можно на обоих.
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  let body: unknown
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, signal: abort.signal })
    body = await readJson(response)
  } catch (cause) {
    throw new ApiError('NETWORK', 'Запрос не дошёл до сервера', undefined, cause)
  } finally {
    clearTimeout(timer)
  }

  // readJson глотает нечитаемое тело — в том числе оборванное по таймауту.
  // Без этой проверки обрыв на чтении стал бы CONTRACT_VIOLATION вместо NETWORK.
  if (abort.signal.aborted) {
    throw new ApiError('NETWORK', 'Сервер не ответил вовремя')
  }

  if (!response.ok) {
    const envelope = ErrorEnvelope.safeParse(body)
    if (envelope.success) throw ApiError.fromBody(envelope.data.error)
    throw new ApiError(
      'CONTRACT_VIOLATION',
      `Ответ ${response.status} не похож на конверт ошибки контракта`,
      { status: response.status },
    )
  }

  const parsed = schema.safeParse(body) as { success: boolean; data?: T; error?: unknown }
  if (!parsed.success) {
    throw new ApiError('CONTRACT_VIOLATION', 'Ответ сервера не прошёл проверку контракта', {
      status: response.status,
      issues: parsed.error,
    })
  }
  return parsed.data as T
}

const jsonHeaders = { 'Content-Type': 'application/json' }

/**
 * Сессия кабинета уходит заголовком Authorization, а не в пути и не в теле:
 * в URL токен попал бы в логи прокси и в Referer, а за ним — список чужих
 * заявок с телефонами (§3).
 */
const bearer = (token: string) => ({ ...jsonHeaders, Authorization: `Bearer ${token}` })

/** Список заявок кабинета: массив проекций, а не объект с полем (§5б). */
const RequestsForMaster = z.array(RequestForMasterListItem)

export const httpApi: Api = {
  async createRequest(input: CreateRequestInput) {
    const payload = parseInput<CreateRequest>(CreateRequest, input)
    return call('/api/requests', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }, RequestCreated)
  },

  async resendOtp(input: ResendOtpInputLike) {
    // requestId уходит в путь, тело пустое (§5, resendOtp).
    const { requestId } = parseInput<ResendOtpInput>(ResendOtpInput, input)
    return call(`/api/requests/${encodeURIComponent(requestId)}/otp/resend`, {
      method: 'POST',
      headers: jsonHeaders,
    }, OtpSent)
  },

  async confirmOtp(input: ConfirmOtpInputLike) {
    const { requestId, code } = parseInput<ConfirmOtpInput>(ConfirmOtpInput, input)
    return call(`/api/requests/${encodeURIComponent(requestId)}/otp/confirm`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ code }),
    }, RequestConfirmed)
  },

  async getRequestByToken(token: string) {
    return call(`/api/client/requests/${encodeURIComponent(token)}`, {
      method: 'GET',
    }, RequestForClient)
  },

  /**
   * Multipart, один файл за вызов. Заголовок Content-Type здесь НЕ ставится
   * намеренно: его вместе с boundary проставляет сам браузер, а заданный
   * руками обрывает разбор на сервере.
   */
  async uploadPhoto(file: UploadPhotoInputLike) {
    const body = new FormData()
    body.append('file', file)
    return call('/api/photos', { method: 'POST', body }, Photo)
  },

  /**
   * Удаление снятого снимка. Тела в ответе нет, поэтому схема пропускающая:
   * разбирать нечего, а ошибки всё равно перехватит call по статусу.
   */
  async deletePhoto(id: string) {
    await call(`/api/photos/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: jsonHeaders,
    }, PASSTHROUGH)
  },

  async masterRequestCode(input: MasterCodeInputLike) {
    const payload = parseInput<MasterRequestCodeInput>(MasterRequestCodeInput, input)
    return call('/api/master/otp/request', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }, OtpSent)
  },

  async masterConfirmCode(input: MasterConfirmInputLike) {
    const payload = parseInput<MasterConfirmCodeInput>(MasterConfirmCodeInput, input)
    return call('/api/master/otp/confirm', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }, MasterSession)
  },

  async listRequestsForMaster(token: string) {
    return call('/api/master/requests', {
      method: 'GET',
      headers: bearer(token),
    }, RequestsForMaster)
  },

  async getRequestForMaster(token: string, id: string) {
    return call(`/api/master/requests/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: bearer(token),
    }, RequestForMaster)
  },

  async createQuote(token: string, id: string, input: CreateQuoteInputLike) {
    const payload = parseInput<CreateQuote>(CreateQuote, input)
    return call(`/api/master/requests/${encodeURIComponent(id)}/quote`, {
      method: 'POST',
      headers: bearer(token),
      body: JSON.stringify(payload),
    }, Quote)
  },
}

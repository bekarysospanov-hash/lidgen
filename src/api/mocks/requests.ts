// Четыре операции скелета в памяти (docs/api-contract.md §5). Мок реализует
// контракт, а не обходит его: каждый ответ проходит свою zod-схему перед
// отдачей, ошибки возвращаются те же, что обязан вернуть сервер (§1, §10).
import {
  SendEventsInput,
  ConfirmOtpInput,
  CreateRequest,
  RequestConfirmed,
  RequestCreated,
  RequestForClient,
  ResendOtpInput,
  ResendLinkInput,
  LinkResent,
  OtpSent,
} from '../../contract'
import type { RequestStatus } from '../../contract'
import type {
  ConfirmOtpInputLike,
  CreateRequestInput,
  ResendLinkInputLike,
  ResendOtpInputLike,
} from '../types'
import { ApiError, validationFailed } from '../errors'
import { covered } from './coverage'
import { routeRequest } from './routing'
import {
  OTP_CHANNEL,
  OTP_CODE_LENGTH,
  OTP_RESEND_COOLDOWN_SEC,
  isOtpValid,
  resendRetryAfterSec,
} from './otp'
import {
  addEvent,
  findByClientRequestId,
  findByToken,
  findLatestConfirmedByPhone,
  getRequestRecord,
  newId,
  newToken,
  nextNumber,
  putRequest,
  type RequestRecord,
} from './store'

function notFound(): ApiError {
  return new ApiError('REQUEST_NOT_FOUND', 'Заявка не найдена')
}

/** Ответ мока обязан проходить свою схему — иначе он врёт про контракт. */
function ensure<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  return schema.parse(value)
}

/** Проекция без id и phone собирается на отдаче, а не хранится (§5, §7). */
function toClientProjection(record: RequestRecord) {
  return ensure(RequestForClient, {
    number: record.number,
    status: record.status,
    createdAt: record.createdAt,
    phoneConfirmedAt: record.phoneConfirmedAt,
    routedAt: record.routedAt,
    completedManually: record.completedManually,
    details: record.details,
    mainSize: record.mainSize,
    description: record.description,
    city: record.city,
    district: record.district,
    deadline: record.deadline,
    finishLevel: record.finishLevel,
    photos: record.photos,
    quotes: record.quotes,
  })
}

/**
 * Классификация статуса внутри confirmOtp (§4):
 * !covered(city) → out_of_coverage; иначе !mainSize.known → incomplete;
 * иначе qualified. out_of_coverage приоритетнее incomplete — звонить туда,
 * где некому передать заказ, работа впустую.
 */
function classify(record: RequestRecord): RequestStatus {
  if (!covered(record.city.code)) return 'out_of_coverage'
  if (!record.mainSize.known) return 'incomplete'
  return 'qualified'
}

function otpSentBody(record: RequestRecord, now: Date) {
  return ensure(OtpSent, {
    channel: OTP_CHANNEL,
    codeLength: OTP_CODE_LENGTH,
    retryAfterSec: resendRetryAfterSec(record.otpSentAt, now),
  })
}

function createdBody(record: RequestRecord, now: Date) {
  return ensure(RequestCreated, {
    id: record.id,
    number: record.number,
    status: 'unconfirmed',
    createdAt: record.createdAt,
    otp: otpSentBody(record, now),
  })
}

export function create(input: CreateRequestInput): RequestCreated {
  const parsed = CreateRequest.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)
  const payload = parsed.data
  const now = new Date()

  // Идемпотентность по clientRequestId: второй вызов возвращает ту же заявку,
  // не создаёт запись и не шлёт второй код (§5, §8).
  if (payload.clientRequestId) {
    const existing = findByClientRequestId(payload.clientRequestId)
    if (existing) return createdBody(existing, now)
  }

  const record: RequestRecord = {
    id: newId(),
    number: nextNumber(now),
    status: 'unconfirmed',
    createdAt: now.toISOString(),
    phoneConfirmedAt: null,
    routedAt: null,
    completedManually: false,
    details: payload.details,
    mainSize: payload.mainSize,
    description: payload.description,
    city: payload.city,
    district: payload.district ?? null,
    deadline: payload.deadline ?? null,
    finishLevel: payload.finishLevel ?? null,
    phone: payload.phone,
    consent: payload.consent ?? null,
    source: payload.source ?? null,
    clientRequestId: payload.clientRequestId ?? null,
    token: null,
    otpSentAt: now.toISOString(),
    clientFirstOpenedAt: null,
    photos: payload.photos ?? [],
    quotes: [],
  }
  putRequest(record)

  // Оба события одним вызовом (§5, createRequest).
  // Заявку отправила заказчица; код следом рассылает сервер сам — её об этом
  // не спрашивали, поэтому роли у двух событий разные.
  addEvent('request_submitted', record.id, 'client')
  addEvent('otp_requested', record.id, 'system', { channel: OTP_CHANNEL })

  return createdBody(record, now)
}

/**
 * US-21 — прислать ссылку заново. Ответ одинаков независимо от того, есть
 * заявка по номеру или нет: иначе форма становится проверкой «оставлял ли
 * этот человек заявку», то есть перечислением по номеру телефона (§5).
 *
 * Само сообщение отправляет сервер; у фронта такой операции нет и не будет.
 * В пробе мессенджера нет вовсе — поэтому мок только пишет событие, а ссылку
 * экран показывает на месте под меткой PROBE.
 */
export function resendLink(input: ResendLinkInputLike): LinkResent {
  const parsed = ResendLinkInput.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  const record = findLatestConfirmedByPhone(parsed.data.phone)
  // Событие пишется только когда отправлять действительно есть что: иначе
  // в воронке появились бы «отправки» несуществующих ссылок.
  if (record) addEvent('link_resent', record.id, 'client', { channel: OTP_CHANNEL })

  return { channel: OTP_CHANNEL, retryAfterSec: OTP_RESEND_COOLDOWN_SEC }
}

/**
 * PROBE: мессенджера в пробе нет, и ссылку иначе никак не получить. Экран
 * показывает её на месте — при VITE_USE_MOCKS=false этой функции не остаётся
 * вместе со всеми моками.
 */
export function probeLinkFor(phone: string): string | null {
  const record = findLatestConfirmedByPhone(phone)
  return record ? `/offers/${record.token}` : null
}

export function resend(input: ResendOtpInputLike): OtpSent {
  const parsed = ResendOtpInput.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  const record = getRequestRecord(parsed.data.requestId)
  if (!record) throw notFound()
  if (record.phoneConfirmedAt) {
    throw new ApiError('ALREADY_CONFIRMED', 'Номер уже подтверждён')
  }

  const now = new Date()
  const retryAfterSec = resendRetryAfterSec(record.otpSentAt, now)
  if (retryAfterSec > 0) {
    throw new ApiError('OTP_RESEND_TOO_SOON', 'Код можно запросить чуть позже', {
      retryAfterSec,
    })
  }

  record.otpSentAt = now.toISOString()
  putRequest(record)
  // Повторную отправку просит человек — в отличие от рассылки при создании.
  addEvent('otp_requested', record.id, 'client', { channel: OTP_CHANNEL, resend: true })

  return ensure(OtpSent, {
    channel: OTP_CHANNEL,
    codeLength: OTP_CODE_LENGTH,
    retryAfterSec: resendRetryAfterSec(record.otpSentAt, now),
  })
}

export function confirm(input: ConfirmOtpInputLike): RequestConfirmed {
  const parsed = ConfirmOtpInput.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  const record = getRequestRecord(parsed.data.requestId)
  if (!record) throw notFound()

  const valid = isOtpValid(parsed.data.code)

  // Идемпотентность для верного кода: тот же {request, token}, без повторной
  // классификации и без второго события. Неверный код на подтверждённой
  // заявке → ALREADY_CONFIRMED, не OTP_INVALID (§5).
  if (record.phoneConfirmedAt && record.token) {
    if (!valid) throw new ApiError('ALREADY_CONFIRMED', 'Номер уже подтверждён')
    return ensure(RequestConfirmed, {
      request: toClientProjection(record),
      token: record.token,
    })
  }

  if (!valid) throw new ApiError('OTP_INVALID', 'Код не подошёл')

  const now = new Date()
  record.phoneConfirmedAt = now.toISOString()
  record.status = classify(record)
  record.token = newToken()
  addEvent('otp_confirmed', record.id, 'client', { status: record.status })

  // PROBE: сервера, который маршрутизировал бы отдельным шагом с рассылкой
  // уведомлений (US-15), у пробы нет — мок делает это синхронно, тем же
  // вызовом (§4, §10). Контракт синхронности не требует: qualified без
  // routedAt остаётся законным состоянием.
  routeRequest(record, now)
  putRequest(record)

  return ensure(RequestConfirmed, {
    request: toClientProjection(record),
    token: record.token,
  })
}

export function getByToken(token: string): RequestForClient {
  const record = findByToken(token)
  if (!record) throw new ApiError('TOKEN_INVALID', 'Ссылка не подошла')

  // Первое открытие фиксируется один раз; повторное открытие пишет событие,
  // но clientFirstOpenedAt не двигает (§5, US-21 «пересланная ссылка»).
  if (!record.clientFirstOpenedAt) {
    record.clientFirstOpenedAt = new Date().toISOString()
    putRequest(record)
  }
  addEvent('client_page_opened', record.id, 'client', { quotesCount: record.quotes.length })

  return toClientProjection(record)
}

/**
 * Приём событий воронки (US-25a, §5). Мок кладёт их в тот же журнал, что
 * и события, порождённые операциями: смотреть воронку надо целиком, а не
 * двумя списками. `at` ставит «сервер», как и обещает контракт.
 */
export function acceptEvents(input: unknown): void {
  const parsed = SendEventsInput.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  for (const event of parsed.data.events) {
    addEvent(event.type, event.requestId, event.actor.role, {
      ...(event.payload ?? {}),
      ...(event.sessionId ? { sessionId: event.sessionId } : {}),
    })
  }
}

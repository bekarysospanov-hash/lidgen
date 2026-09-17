// Пять операций кабинета мебельщика в памяти (docs/api-contract.md §5б).
// Мок реализует контракт, а не обходит его: каждый ответ проходит свою
// zod-схему перед отдачей, ошибки — те же, что обязан вернуть сервер (§1).
import {
  CreateQuote,
  MasterConfirmCodeInput,
  MasterRequestCodeInput,
  MasterSession,
  OtpSent,
  Quote,
  RequestForMaster,
  RequestForMasterListItem,
  type Master,
} from '../../contract'
import type { CreateQuoteInputLike, MasterCodeInputLike, MasterConfirmInputLike } from '../types'
import { ApiError, validationFailed } from '../errors'
import {
  findMasterByPhone,
  newQuoteId,
  openSession,
  resolveSession,
  resetSessions,
} from './masters'
import { OTP_CHANNEL, OTP_CODE_LENGTH, isOtpValid, resendRetryAfterSec } from './otp'
import { listRoutedTo, routingFor } from './routing'
import { addEvent, getRequestRecord, onReset, putRequest, type RequestRecord } from './store'

/** Ответ мока обязан проходить свою схему — иначе он врёт про контракт. */
function ensure<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  return schema.parse(value)
}

/** Когда последний раз уходил код на этот номер — от него считается кулдаун. */
const otpSentAt = new Map<string, string>()

export function resetMasterState(): void {
  resetSessions()
  otpSentAt.clear()
}

function unauthorized(): ApiError {
  return new ApiError('MASTER_UNAUTHORIZED', 'Нужно войти заново')
}

/**
 * Чужая заявка и несуществующая отвечают одинаково (§5б): иначе id заявки
 * перебирается на существование — кабинет отвечал бы «такой нет» на выдуманный
 * и «не ваша» на настоящий.
 */
function notYours(): ApiError {
  return new ApiError('NOT_ROUTED_TO_YOU', 'Эта заявка не ваша')
}

function session(token: string, now: Date): Master {
  const master = resolveSession(token, now)
  if (!master) throw unauthorized()
  return master
}

export function requestCode(input: MasterCodeInputLike): OtpSent {
  const parsed = MasterRequestCodeInput.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  const master = findMasterByPhone(parsed.data.phone)
  // PROBE: прод обязан отвечать одинаково, есть номер или нет, — иначе это
  // перечисление пользователей по номеру (§5б). На скелете мебельщиков семь,
  // они заведены нами и знают об этом.
  if (!master) throw new ApiError('MASTER_NOT_FOUND', 'Этого номера нет в списке мастерских')

  const now = new Date()
  const previous = otpSentAt.get(master.phone)
  if (previous) {
    const retryAfterSec = resendRetryAfterSec(previous, now)
    if (retryAfterSec > 0) {
      throw new ApiError('OTP_RESEND_TOO_SOON', 'Код можно запросить чуть позже', {
        retryAfterSec,
      })
    }
  }
  otpSentAt.set(master.phone, now.toISOString())
  addEvent('otp_requested', null, 'master', { channel: OTP_CHANNEL })

  return ensure(OtpSent, {
    channel: OTP_CHANNEL,
    codeLength: OTP_CODE_LENGTH,
    retryAfterSec: resendRetryAfterSec(now.toISOString(), now),
  })
}

export function confirmCode(input: MasterConfirmInputLike): MasterSession {
  const parsed = MasterConfirmCodeInput.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  const master = findMasterByPhone(parsed.data.phone)
  if (!master) throw new ApiError('MASTER_NOT_FOUND', 'Этого номера нет в списке мастерских')

  // Подтверждать можно только тот код, который сервер сам выслал на этот
  // номер (§5б): иначе лимит отправок ничего не защищает — код подбирается
  // в обход отправки вовсе. Ответ тот же, что на неверный код: существование
  // выданного кода — не то, что стоит сообщать вызывающему.
  if (!otpSentAt.has(master.phone)) throw new ApiError('OTP_INVALID', 'Код не подошёл')
  if (!isOtpValid(parsed.data.code)) throw new ApiError('OTP_INVALID', 'Код не подошёл')

  const now = new Date()
  const token = openSession(master.id, now)
  addEvent('otp_confirmed', null, 'master')

  // ALREADY_CONFIRMED здесь не бывает: у сессии нет состояния «уже
  // подтверждена», есть только «выдана» (§5б). Каждый вход — новая сессия.
  return ensure(MasterSession, {
    master: { id: master.id, name: master.name, city: master.city },
    token,
  })
}

function myQuote(record: RequestRecord, masterId: string): Quote | undefined {
  return record.quotes.find((quote) => quote.master.id === masterId)
}

function toListItem(record: RequestRecord, masterId: string, routedAt: string) {
  return ensure(RequestForMasterListItem, {
    id: record.id,
    number: record.number,
    routedAt,
    category: record.details.category,
    mainSize: record.mainSize,
    city: record.city,
    district: record.district,
    deadline: record.deadline,
    photosCount: record.photos.length,
    quotedByMe: myQuote(record, masterId) !== undefined,
  })
}

export function listRequests(token: string): RequestForMasterListItem[] {
  const now = new Date()
  const master = session(token, now)

  // Пустой список законен и на скелете обычен: заявок ещё нет (§5б).
  return listRoutedTo(master.id).flatMap((routing) => {
    const record = getRequestRecord(routing.requestId)
    return record ? [toListItem(record, master.id, routing.routedAt)] : []
  })
}

/**
 * Заявка мебельщика вместе с её маршрутом. Один источник routedAt на обе
 * проекции: брать его из записи заявки, а из маршрута — только факт доступа,
 * значило бы держать одно значение в двух местах и однажды разойтись.
 */
function routedRecord(id: string, masterId: string): { record: RequestRecord; routedAt: string } {
  const routing = routingFor(id)
  const record = getRequestRecord(id)
  // Чужая заявка и несуществующая отвечают одинаково (§5б).
  if (!record || !routing || !routing.masterIds.includes(masterId)) throw notYours()
  return { record, routedAt: routing.routedAt }
}

export function getRequest(token: string, id: string): RequestForMaster {
  const now = new Date()
  const master = session(token, now)

  const { record, routedAt } = routedRecord(id, master.id)

  addEvent('master_opened', record.id, 'master')

  const mine = myQuote(record, master.id)
  return ensure(RequestForMaster, {
    id: record.id,
    number: record.number,
    routedAt,
    details: record.details,
    mainSize: record.mainSize,
    description: record.description,
    city: record.city,
    district: record.district,
    deadline: record.deadline,
    finishLevel: record.finishLevel,
    photos: record.photos,
    myQuote: mine ?? null,
    // Требование ПДн, а не деталь экрана: до своего КП телефон не уходит
    // на фронт вовсе — скрыть уже присланное значение на клиенте нельзя (§7).
    clientPhone: mine ? record.phone : null,
  })
}

export function sendQuote(token: string, id: string, input: CreateQuoteInputLike): Quote {
  const now = new Date()
  const master = session(token, now)

  const { record } = routedRecord(id, master.id)
  if (myQuote(record, master.id)) {
    throw new ApiError('QUOTE_ALREADY_SENT', 'Вы уже ответили по этой заявке')
  }

  const parsed = CreateQuote.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  // master проставляется из сессии, а не из тела запроса: иначе мебельщик
  // отправляет КП от чужого имени (§5б).
  const quote = ensure(Quote, {
    id: newQuoteId(),
    requestId: record.id,
    master: { id: master.id, name: master.name, phone: master.phone },
    composition: parsed.data.composition,
    materials: parsed.data.materials,
    price: parsed.data.price,
    leadTimeDays: parsed.data.leadTimeDays,
    photos: parsed.data.photos ?? [],
    sentAt: now.toISOString(),
    updatedAt: null,
  })

  record.quotes.push(quote)
  // Первое КП переводит routed → quoted; второе и третье статус не двигают:
  // quoted означает «есть хотя бы одно КП», а не «пришли все» (§4).
  if (record.status === 'routed') record.status = 'quoted'
  putRequest(record)
  addEvent('quote_sent', record.id, 'master', { masterId: master.id })

  return quote
}

onReset(resetMasterState)

/**
 * US-19b — дополнить своё КП. Правится существующее, а не создаётся новое:
 * id и sentAt остаются прежними, двигается только updatedAt. Иначе правка
 * считалась бы вторым предложением, и «сколько КП пришло» врало бы.
 */
export function reviseQuote(
  token: string,
  id: string,
  input: CreateQuoteInputLike,
): Quote {
  const now = new Date()
  const master = session(token, now)

  const { record } = routedRecord(id, master.id)
  const mine = myQuote(record, master.id)
  if (!mine) throw new ApiError('QUOTE_NOT_FOUND', 'Предложение не найдено')

  const parsed = CreateQuote.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  const revised = ensure(Quote, {
    ...mine,
    composition: parsed.data.composition,
    materials: parsed.data.materials,
    price: parsed.data.price,
    leadTimeDays: parsed.data.leadTimeDays,
    photos: parsed.data.photos ?? mine.photos,
    updatedAt: now.toISOString(),
  })

  record.quotes = record.quotes.map((quote) => (quote.id === revised.id ? revised : quote))
  putRequest(record)
  // Событие quote_sent не пишется: КП не новое, и в метрике оно уже учтено.

  return revised
}

// Пять операций кабинета мебельщика в памяти (docs/api-contract.md §5б).
// Мок реализует контракт, а не обходит его: каждый ответ проходит свою
// zod-схему перед отдачей, ошибки — те же, что обязан вернуть сервер (§1).
import {
  AuthConfirmCodeInput,
  AuthRequestCodeInput,
  CreateQuote,
  OtpSent,
  Session,
  Quote,
  RequestForMaster,
  RequestForMasterListItem,
  UpdateMyCard,
  type Master,
  type MyCard,
} from '../../contract'
import type { AuthCodeInputLike, AuthConfirmInputLike, CreateQuoteInputLike } from '../types'
import { ApiError, validationFailed } from '../errors'
import { findMasterByPhone, newQuoteId, readMyCard, writeMyCard } from './masters'
import {
  closeSession,
  lastCodeSentAt,
  openSession,
  phoneOf,
  rememberCodeSent,
  rememberIdentity,
  resetAuthState,
  rolesFor,
} from './auth'
import { OTP_CHANNEL, OTP_CODE_LENGTH, isOtpValid, resendRetryAfterSec } from './otp'
import { listRoutedTo, routingFor } from './routing'
import { addEvent, getRequestRecord, onReset, putRequest, type RequestRecord } from './store'

/** Ответ мока обязан проходить свою схему — иначе он врёт про контракт. */
function ensure<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  return schema.parse(value)
}

export function resetMasterState(): void {
  resetAuthState()
}

function unauthorized(): ApiError {
  return new ApiError('MASTER_UNAUTHORIZED', 'Кабинет мастерской — для мастерских')
}

/**
 * Чужая заявка и несуществующая отвечают одинаково (§5б): иначе id заявки
 * перебирается на существование — кабинет отвечал бы «такой нет» на выдуманный
 * и «не ваша» на настоящий.
 */
function notYours(): ApiError {
  return new ApiError('NOT_ROUTED_TO_YOU', 'Эта заявка не ваша')
}

/**
 * Мастерская вошедшего. Два разных отказа вместо одного (§5в, 20.09):
 * нет сессии — UNAUTHORIZED, «войдите заново»; сессия есть, а роли нет —
 * MASTER_UNAUTHORIZED, «этот кабинет не для вас». Раньше оба случая
 * отвечали одинаково, и вошедший заказчик отправлялся на вход повторно.
 *
 * Роль проверяется здесь, при каждом вызове, а не берётся снимком
 * из сессии: снятая с публикации мастерская теряет доступ сразу.
 */
function session(token: string, now: Date): Master {
  const phone = phoneOf(token, now)
  const master = findMasterByPhone(phone)
  if (!master) throw unauthorized()
  return master
}

/**
 * §5в — шаг 1 входа. Отвечает ОДИНАКОВО любому номеру: есть он в реестре
 * мастерских или нет, вызывающий этого не узнаёт. До 20.09 здесь стоял
 * MASTER_NOT_FOUND, и дверь кабинета работала перечислением мастерских
 * по номеру — PROBE-оговорка снята вместе с ним.
 */
export function authRequestCode(input: AuthCodeInputLike): OtpSent {
  const parsed = AuthRequestCodeInput.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  const phone = parsed.data.phone
  const now = new Date()
  const previous = lastCodeSentAt(phone)
  if (previous) {
    const retryAfterSec = resendRetryAfterSec(previous, now)
    if (retryAfterSec > 0) {
      throw new ApiError('OTP_RESEND_TOO_SOON', 'Код можно запросить чуть позже', {
        retryAfterSec,
      })
    }
  }
  rememberCodeSent(phone, now.toISOString())
  // Согласие запоминается на шаге запроса: человек нажал кнопку, прочитав
  // строку о политике, и дальше может не дойти — но телефон у нас уже есть.
  rememberIdentity(phone, parsed.data.consent)
  // Роль в событии — та, под которой человек войдёт: метрика US-17
  // (сколько мебельщиков дошло до кабинета) от одной двери не ломается.
  addEvent('otp_requested', null, rolesFor(phone).includes('master') ? 'master' : 'client', {
    channel: OTP_CHANNEL,
  })

  return ensure(OtpSent, {
    channel: OTP_CHANNEL,
    codeLength: OTP_CODE_LENGTH,
    retryAfterSec: resendRetryAfterSec(now.toISOString(), now),
  })
}

/**
 * §5в — шаг 2 входа. Роли выводятся из номера сервером; человек их
 * не выбирает и фронт их не решает. Каждый успешный вход — новая сессия:
 * состояния «уже подтверждена» у неё нет.
 */
export function authConfirmCode(input: AuthConfirmInputLike): Session {
  const parsed = AuthConfirmCodeInput.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)

  const phone = parsed.data.phone
  // Подтверждать можно только тот код, который сервер сам выслал на этот
  // номер: иначе лимит отправок ничего не защищает — код подбирается
  // в обход отправки вовсе. Ответ тот же, что на неверный код.
  if (lastCodeSentAt(phone) === undefined) throw new ApiError('OTP_INVALID', 'Код не подошёл')
  if (!isOtpValid(parsed.data.code)) throw new ApiError('OTP_INVALID', 'Код не подошёл')

  const now = new Date()
  const session = openSession(phone, now)
  addEvent('otp_confirmed', null, session.roles.includes('master') ? 'master' : 'client')
  return ensure(Session, session)
}

/** §5в — выход. Отзывает сессию на сервере, а не только чистит вкладку. */
export function signOut(token: string): void {
  closeSession(token)
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
    photosCount: record.photos.length,
    readiness: record.readiness,
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
    finishLevel: record.finishLevel,
    readiness: record.readiness,
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

/** US-20 — своя карточка: посмотреть (§5б, getMyCard). */
export function myCard(token: string): MyCard {
  return readMyCard(session(token, new Date()))
}

/** US-20 — своя карточка: поправить текст (§5б, updateMyCard). */
export function saveMyCard(token: string, input: unknown): MyCard {
  const master = session(token, new Date())
  const parsed = UpdateMyCard.safeParse(input)
  if (!parsed.success) throw validationFailed(parsed.error)
  return writeMyCard(master, parsed.data)
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

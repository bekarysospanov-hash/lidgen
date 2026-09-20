// §5в — вход в памяти. Одна дверь на обе роли (решение PM 20.09).
//
// Мок реализует контракт, а не обходит его: шаг запроса кода отвечает
// одинаково любому номеру, и «есть ли такой мебельщик» здесь узнать нельзя
// — ровно как обязан вести себя сервер. До 20.09 дверь мебельщика отвечала
// MASTER_NOT_FOUND, и по ней перебирался реестр мастерских.
//
// Роль выводится при каждом обращении, а не кладётся в сессию снимком:
// мастерская, снятая с публикации, теряет доступ немедленно.
import { Session, type SessionRole } from '../../contract'
import { ApiError } from '../errors'
import { findMasterByPhone } from './masters'
import { newToken, onReset } from './store'

/**
 * Срок сессии. Одно число на обе роли, пока сессия живёт в памяти вкладки:
 * более долгая серверная сессия при токене, умирающем с вкладкой, — это
 * живые ключи, которых никто не держит. Долгий вход придёт вместе
 * с cookie-транспортом, это решение разработчика (контракт §9).
 */
export const SESSION_TTL_HOURS = 12

interface SessionRecord {
  phone: string
  expiresAt: number
}

/**
 * Идентичности: номера, владение которыми доказано кодом. Заводится
 * при первом входе и живёт дальше — с ней связаны заявки по тому же номеру.
 *
 * Согласие хранится здесь же: человек может войти, не оставив ни одной
 * заявки, и тогда у продукта появился бы телефон без правового основания.
 */
const identities = new Map<string, { consentAcceptedAt: string; policyVersion: string }>()
const sessions = new Map<string, SessionRecord>()

/** Когда на этот номер последний раз уходил код — от него считается кулдаун. */
const codeSentAt = new Map<string, string>()

export function resetAuthState(): void {
  identities.clear()
  sessions.clear()
  codeSentAt.clear()
}

onReset(resetAuthState)

export function lastCodeSentAt(phone: string): string | undefined {
  return codeSentAt.get(phone)
}

export function rememberCodeSent(phone: string, at: string): void {
  codeSentAt.set(phone, at)
}

/** Запоминает согласие. Второй вход тем же номером обновляет отметку. */
export function rememberIdentity(phone: string, consent: { policyVersion: string; acceptedAt: string }): void {
  identities.set(phone, {
    consentAcceptedAt: consent.acceptedAt,
    policyVersion: consent.policyVersion,
  })
}

/**
 * Роли номера. `client` есть у всякого, кто подтвердил владение: заказать
 * мебель может кто угодно. `master` — только если номер в реестре мастерских.
 */
export function rolesFor(phone: string): SessionRole[] {
  return findMasterByPhone(phone) ? ['client', 'master'] : ['client']
}

/** Новая сессия по подтверждённому номеру. Каждый вход — своя. */
export function openSession(phone: string, now: Date): Session {
  const token = newToken()
  const expiresAt = now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000
  sessions.set(token, { phone, expiresAt })
  const master = findMasterByPhone(phone)
  return Session.parse({
    token,
    roles: rolesFor(phone),
    expiresAt: new Date(expiresAt).toISOString(),
    // Профиль — ровно три поля, как в контракте: под какой мастерской
    // человек отвечает. Карточка и телефон сюда не едут.
    master: master ? { id: master.id, name: master.name, city: master.city } : null,
  })
}

/** Номер по токену или undefined — протух, отозван, выдуман. */
export function resolveSession(token: string, now: Date): string | undefined {
  const record = sessions.get(token)
  if (!record) return undefined
  if (record.expiresAt <= now.getTime()) {
    sessions.delete(token)
    return undefined
  }
  return record.phone
}

/** Выход отзывает сессию на сервере, а не только чистит хранилище вкладки. */
export function closeSession(token: string): void {
  sessions.delete(token)
}

export function unauthorized(): ApiError {
  return new ApiError('UNAUTHORIZED', 'Нужно войти заново')
}

/**
 * Номер вошедшего. Бросает UNAUTHORIZED, если сессии нет: «войдите заново»
 * и «этот кабинет не для вас» — разные случаи и разные ответы.
 */
export function phoneOf(token: string, now: Date): string {
  const phone = resolveSession(token, now)
  if (phone === undefined) throw unauthorized()
  return phone
}

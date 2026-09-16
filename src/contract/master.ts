// Мебельщик и маршрутизация (docs/api-contract.md §2, §3, §5б).
//
// Вторая половина среза 1: US-14 «маршрутизация троим», US-17 «вход
// мебельщика». Заявка, дошедшая до кабинета, — единственное, ради чего
// скелет собирается: без неё «момент истины» из story-map.md не наступает.
import { z } from 'zod'
import { City, Iso, OtpCode, Phone, RequestId, Token } from './primitives'

/** Не больше трёх получателей на заявку (US-14, §2 Routing). */
export const ROUTING_MAX_MASTERS = 3

/**
 * Сессия кабинета живёт 12 часов — до конца рабочего дня, не до конца жизни
 * заявки. Клиентский token открывает одну заявку тому, кто ей владеет,
 * masterToken — список чужих заявок и право отправить КП (§3).
 */
export const MASTER_SESSION_TTL_HOURS = 12

/**
 * Мебельщик. Заводится нами (A2), самостоятельной регистрации в пробе нет:
 * правка своей карточки — US-20, срез 3.
 */
export const Master = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  city: City,
  /** По нему же вход в кабинет (US-17). Наружу уходит только в каталоге. */
  phone: Phone,
  /**
   * «На приёме» с этого момента. Не булев флаг: на разборе эксперимента
   * нужно уметь сказать, что заявка пришла до выхода мебельщика на приём,
   * а не угадывать это (§2).
   */
  acceptingFrom: Iso.nullable(),
})
export type Master = z.infer<typeof Master>

/**
 * Проекция Master для него самого: телефон свой он знает, acceptingFrom —
 * наше служебное состояние, не его (§2).
 */
export const MasterProfile = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1),
  city: City,
})
export type MasterProfile = z.infer<typeof MasterProfile>

/** Ответ masterConfirmCode: кто вошёл и чем дальше авторизуется (§5б). */
export const MasterSession = z.object({
  master: MasterProfile,
  token: Token,
})
export type MasterSession = z.infer<typeof MasterSession>

/** Вход masterRequestCode — только номер, пароля в кабинете нет вовсе. */
export const MasterRequestCodeInput = z.object({ phone: Phone })
export type MasterRequestCodeInput = z.infer<typeof MasterRequestCodeInput>

/** Вход masterConfirmCode: номер и код из сообщения. */
export const MasterConfirmCodeInput = z.object({ phone: Phone, code: OtpCode })
export type MasterConfirmCodeInput = z.infer<typeof MasterConfirmCodeInput>

/**
 * Кому ушла заявка. Серверная запись, целиком не отдаётся никому: заказчице
 * виден только факт (routedAt), мебельщику — только то, что заявка есть
 * в его списке. Переназначения нет: маршрут пишется один раз (§2).
 */
export const Routing = z.object({
  requestId: RequestId,
  masterIds: z.array(z.uuid()).min(1).max(ROUTING_MAX_MASTERS),
  routedAt: Iso,
})
export type Routing = z.infer<typeof Routing>

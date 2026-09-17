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
/**
 * Публичная карточка каталога (US-02). Появляется только после согласия
 * мастерской на публикацию и заполнения карточки нами (трек A2).
 *
 * Запрет, вынесенный из PRD в контракт: сгенерированные карточки, спарсенные
 * чужие портфолио и вымышленные мастерские «для объёма» недопустимы. Заявка
 * на несуществующее предложение делает CPL неинтерпретируемым, а чужие фото —
 * это чужое авторское право в среде, где работы узнают мгновенно.
 */
export const MasterCard = z.object({
  about: z.string().trim().min(1).max(600),
  yearsOnMarket: z.int().min(0),
  does: z.array(z.string().trim().min(1)).min(1).max(6),
  /** Свои работы, снятые у своих заказчиков. Ни одной чужой. */
  photos: z.array(z.string().min(1)).min(1).max(6),
  publishedAt: Iso,
})
export type MasterCard = z.infer<typeof MasterCard>

/** Что видит заказчица в каталоге. Телефона здесь нет: контакт — US-24. */
export const MasterCardPublic = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1),
  city: City,
  card: MasterCard,
})
export type MasterCardPublic = z.infer<typeof MasterCardPublic>

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
  /**
   * Публичная карточка. null, пока согласия на публикацию нет: мастерская
   * может принимать заявки и не быть в каталоге — это разные решения.
   */
  card: MasterCard.nullable().default(null),
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

/**
 * Что мебельщик видит о себе в кабинете (§5б, getMyCard). US-20.
 *
 * `name` и `city` здесь для показа, а не для правки: город определяет, какие
 * заявки ему придут, и менять его самостоятельно он не может. `acceptingFrom`
 * не отдаётся вовсе — это наше служебное состояние, и его показ породил бы
 * вопрос «как включить», ответа на который в пробе нет.
 *
 * `card: null` — законное состояние, а не ошибка: мастерская может принимать
 * заявки и не быть в каталоге, пока согласия на публикацию нет.
 */
export const MyCard = z.strictObject({
  name: z.string().min(1),
  city: City,
  card: MasterCard.nullable(),
})
export type MyCard = z.infer<typeof MyCard>

/**
 * Тело updateMyCard (§5б). Правится только текст: чем занимается, сколько лет
 * на рынке, что умеет.
 *
 * Фотографий здесь нет намеренно. `photos` — свои работы, снятые у своих
 * заказчиков, и запрет на чужие портфолио держится на том, что снимки
 * собираем и проверяем мы (A2). Загрузка из кабинета потребовала бы
 * модерации, которой в пробе нет, а без неё первое же чужое фото ломает
 * обещание «мы отобрали и проверили».
 *
 * `publishedAt` тоже не здесь: дата публикации — след согласия, и правка
 * текста не делает карточку опубликованной заново.
 */
export const UpdateMyCard = MasterCard.pick({
  about: true,
  yearsOnMarket: true,
  does: true,
})
export type UpdateMyCard = z.infer<typeof UpdateMyCard>

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

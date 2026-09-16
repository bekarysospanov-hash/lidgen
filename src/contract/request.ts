// Заявка и её проекции (docs/api-contract.md §2, §4, §5).
import { z } from 'zod'
import {
  City,
  Description,
  Iso,
  MainSize,
  Phone,
  RequestId,
  RequestNumber,
  Token,
} from './primitives'
import { OtpSent } from './otp'
import { Photo, Photos } from './photo'
import { Quote } from './quote'

export const CategoryId = z.enum(['kitchen', 'wardrobe', 'bathroom', 'other'])
export type CategoryId = z.infer<typeof CategoryId>

export const KitchenShape = z.enum(['straight', 'corner', 'u-shape', 'island'])
export type KitchenShape = z.infer<typeof KitchenShape>

export const KitchenAppliances = z.enum(['yes', 'no', 'undecided'])
export type KitchenAppliances = z.infer<typeof KitchenAppliances>

/**
 * Details расширяется веткой, а не общей формой: поля wardrobe/bathroom/other
 * появятся в US-06/US-07 и не сломают уже сохранённые заявки kitchen (§2).
 * Ветки строгие — лишнее поле чужой категории не проглатывается молча.
 */
export const KitchenDetails = z.strictObject({
  category: z.literal('kitchen'),
  shape: KitchenShape.nullable().default(null),
  appliances: KitchenAppliances.nullable().default(null),
})

export const WardrobeDetails = z.strictObject({ category: z.literal('wardrobe') })
export const BathroomDetails = z.strictObject({ category: z.literal('bathroom') })
export const OtherDetails = z.strictObject({ category: z.literal('other') })

export const Details = z.discriminatedUnion('category', [
  KitchenDetails,
  WardrobeDetails,
  BathroomDetails,
  OtherDetails,
])
export type Details = z.infer<typeof Details>

/** Восемь состояний, включая out_of_coverage (§4, зафиксированное расхождение). */
export const RequestStatus = z.enum([
  'unconfirmed',
  'qualified',
  'incomplete',
  'out_of_coverage',
  'unreached',
  'routed',
  'quoted',
  'closed',
])
export type RequestStatus = z.infer<typeof RequestStatus>

export const FinishLevel = z.enum(['basic', 'medium', 'premium'])
export type FinishLevel = z.infer<typeof FinishLevel>

/** Обязателен с US-11 (срез 2), пока опционален (§2, §9). */
export const Consent = z.object({ policyVersion: z.string().min(1), acceptedAt: Iso })
export type Consent = z.infer<typeof Consent>

/** US-26, срез 2: читается контрактом, агрегируется вне API. */
export const Source = z.object({
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  referrer: z.string().optional(),
})
export type Source = z.infer<typeof Source>

/** Тело POST /api/requests (§5). */
export const CreateRequest = z.object({
  details: Details,
  mainSize: MainSize,
  description: Description,
  city: City,
  phone: Phone,
  district: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  finishLevel: FinishLevel.nullable().optional(),
  consent: Consent.optional(),
  source: Source.optional(),
  /** US-10. Пустой список законен: фото не блокирует отправку (§5). */
  photos: Photos.optional(),
  /** Ключ идемпотентности: один на попытку отправки формы, не на клик (§8). */
  clientRequestId: RequestId.optional(),
})
export type CreateRequest = z.infer<typeof CreateRequest>

/** Ответ createRequest. Токена здесь нет — он выдаётся только в confirmOtp (§3). */
export const RequestCreated = z.object({
  id: RequestId,
  number: RequestNumber,
  status: z.literal('unconfirmed'),
  createdAt: Iso,
  otp: OtpSent,
})
export type RequestCreated = z.infer<typeof RequestCreated>

/**
 * Проекция для заказчицы: без id и без phone (§5, §7). Строгая —
 * лишнее поле роняет разбор, а не отбрасывается молча: так утечка ПДн
 * в клиентский ответ становится ошибкой стыковки, а не тихой находкой.
 */
export const RequestForClient = z.strictObject({
  number: RequestNumber,
  status: RequestStatus,
  createdAt: Iso,
  phoneConfirmedAt: Iso.nullable(),
  routedAt: Iso.nullable(),
  completedManually: z.boolean(),
  details: Details,
  mainSize: MainSize,
  description: z.string(),
  city: City,
  district: z.string().nullable(),
  deadline: z.string().nullable(),
  finishLevel: FinishLevel.nullable(),
  photos: z.array(Photo),
  quotes: z.array(Quote),
})
export type RequestForClient = z.infer<typeof RequestForClient>

/**
 * Проекция для списка заявок в кабинете (US-18, §5б). Отдельная от карточки
 * не ради экрана, а ради сервера: гонять описание и пять снимков в списке
 * из двадцати строк незачем. Строгая — лишнее поле роняет разбор, а не
 * проглатывается: так утечка телефона в список становится ошибкой стыковки.
 */
export const RequestForMasterListItem = z.strictObject({
  id: RequestId,
  number: RequestNumber,
  /** Когда заявка пришла ЕМУ, а не когда создана. Список сортируется по нему. */
  routedAt: Iso,
  category: CategoryId,
  mainSize: MainSize,
  city: City,
  district: z.string().nullable(),
  deadline: z.string().nullable(),
  /** Число, а не снимки: «есть 3 фото» — всё, что нужно в списке. */
  photosCount: z.int().min(0),
  /** Отвечал уже или нет. Иначе мебельщик отвечает дважды (US-19a). */
  quotedByMe: z.boolean(),
})
export type RequestForMasterListItem = z.infer<typeof RequestForMasterListItem>

/**
 * Проекция карточки заявки (US-18, US-19a, §5б) — по ней называется вилка.
 *
 * Чего здесь нет и почему: `status` — восемь состояний §4 внутренняя кухня,
 * мебельщику полезен один бит «я уже ответил»; чужие КП — ни цен, ни счётчика
 * «ответили 2 из 3»: подсказка уводит цену от себестоимости к страху опоздать,
 * а эксперимент проверяет как раз цену без выезда.
 */
export const RequestForMaster = z.strictObject({
  id: RequestId,
  number: RequestNumber,
  routedAt: Iso,
  details: Details,
  mainSize: MainSize,
  /** Свободный текст заказчицы — его мебельщик читает первым. */
  description: z.string(),
  city: City,
  district: z.string().nullable(),
  deadline: z.string().nullable(),
  finishLevel: FinishLevel.nullable(),
  photos: z.array(Photo),
  /** Своё отправленное КП — что он уже назвал. Чужих здесь нет. */
  myQuote: Quote.nullable(),
  /**
   * null до отправки своего КП, номер — после (§7). Требование ПДн, а не
   * деталь экрана: до КП телефон не приходит на фронт вовсе, скрыть уже
   * присланное значение на клиенте невозможно.
   */
  clientPhone: Phone.nullable(),
})
export type RequestForMaster = z.infer<typeof RequestForMaster>

/** Ответ confirmOtp: классификация статуса и токен одним ответом (§5). */
export const RequestConfirmed = z.object({
  request: RequestForClient,
  token: Token,
})
export type RequestConfirmed = z.infer<typeof RequestConfirmed>

// Заявка и её проекции (docs/api-contract.md §2, §4, §5).
import { z } from 'zod'
import {
  CeilingMeters,
  City,
  Description,
  Iso,
  MainSize,
  Meters,
  NicheDepthMeters,
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
 * Отметки без повторов. Форма дубликат создать не может — это чекбоксы, —
 * но контракт описывает и то, что присылает сервер: `['oven','oven']`
 * прошло бы схему и показалось бы мебельщику как «Духовка · Духовка».
 */
const uniqueList = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .refine((list) => new Set(list).size === list.length, 'Повторы не допускаются')
    .default([])

/**
 * Что именно встраивают. Названия бытовой техники — не язык цеха: духовку
 * и посудомойку человек называет теми же словами, что и мебельщик, поэтому
 * список законен там, где «кромка» и «петли» запрещены (DESIGN.md § Content).
 */
export const Appliance = z.enum(['oven', 'hob', 'dishwasher', 'fridge', 'hood', 'microwave'])
export type Appliance = z.infer<typeof Appliance>

/**
 * Верх кухни: открытые полки, закрытые шкафы или антресоли до потолка
 * (решение PM 18.09). Разница в цене заметная — антресоль это ещё один ярус
 * корпусов и фасадов, а открытые полки дешевле закрытых на стоимость дверец.
 */
export const KitchenUpper = z.enum(['open', 'closed', 'attic'])
export type KitchenUpper = z.infer<typeof KitchenUpper>

/**
 * Details расширяется веткой, а не общей формой: поля wardrobe/bathroom/other
 * появятся в US-06/US-07 и не сломают уже сохранённые заявки kitchen (§2).
 * Ветки строгие — лишнее поле чужой категории не проглатывается молча.
 *
 * Полный путь (18.09) добавлен тем же приёмом: все новые поля nullable
 * с умолчанием null, поэтому заявки, оставленные по короткому пути,
 * проходят разбор без правки. Отдельного типа «полной заявки» нет —
 * полнота вычисляется из полей, а не хранится флагом.
 */
export const KitchenDetails = z.strictObject({
  category: z.literal('kitchen'),
  shape: KitchenShape.nullable().default(null),
  appliances: KitchenAppliances.nullable().default(null),
  /** Вторая и третья стена — у угловой и П-образной. Первая живёт в mainSize. */
  secondWallM: Meters.nullable().default(null),
  thirdWallM: Meters.nullable().default(null),
  /** Высота потолка: новосёл знает её из плана квартиры. */
  ceilingM: CeilingMeters.nullable().default(null),
  upper: KitchenUpper.nullable().default(null),
  /** Чем именно встраивают — спрашивается, только когда техника встроенная. */
  applianceList: uniqueList(Appliance, 6),
})

/** Тип дверей шкафа (US-06). Купе и распашные различаются по цене сильно. */
export const WardrobeDoors = z.enum(['swing', 'sliding', 'none'])
export type WardrobeDoors = z.infer<typeof WardrobeDoors>

/** Куда встанет шкаф. Ниша ограничивает изделие, отдельная комната — нет. */
export const WardrobePlacement = z.enum(['niche', 'wall', 'room'])
export type WardrobePlacement = z.infer<typeof WardrobePlacement>

/** Наполнение. Слова человеческие: не «штанга», а «штанга для вешалок». */
export const WardrobeInside = z.enum(['shelves', 'rails', 'drawers', 'tall'])
export type WardrobeInside = z.infer<typeof WardrobeInside>

export const WardrobeDetails = z.strictObject({
  category: z.literal('wardrobe'),
  doors: WardrobeDoors.nullable().default(null),
  /** До потолка или нет — от этого зависит и цена, и сложность монтажа. */
  toCeiling: z.boolean().nullable().default(null),
  placement: WardrobePlacement.nullable().default(null),
  /**
   * Глубина ниши — единственное место продукта, где глубину спрашивают.
   * У кухни и ванной её задаёт мастер, и ответ заказчика был бы шумом;
   * здесь ниша ограничивает изделие физически.
   */
  nicheDepthM: NicheDepthMeters.nullable().default(null),
  ceilingM: CeilingMeters.nullable().default(null),
  inside: uniqueList(WardrobeInside, 4),
})

/** Тумба висит на стене или стоит на полу — разный монтаж и разная цена. */
export const BathroomMount = z.enum(['wall', 'floor'])
export type BathroomMount = z.infer<typeof BathroomMount>

/** Раковина уже есть или подбирать — входит ли она в цену. */
export const BathroomBasin = z.enum(['have', 'need'])
export type BathroomBasin = z.infer<typeof BathroomBasin>

/** Что нужно из мебели. Пересекается с составом КП, но это желание, не ответ. */
export const BathroomNeed = z.enum(['vanity', 'mirror', 'cabinet'])
export type BathroomNeed = z.infer<typeof BathroomNeed>

export const BathroomDetails = z.strictObject({
  category: z.literal('bathroom'),
  mount: BathroomMount.nullable().default(null),
  basin: BathroomBasin.nullable().default(null),
  needs: uniqueList(BathroomNeed, 3),
})

/**
 * Подкатегория «Другого» (решение PM 18.09). Список по комнатам, а не по
 * предметам: заказывают «детскую», а не «кровать, шкаф и стол». Смешение
 * осей у нас уже есть и осознано — «Кухня» и «Мебель для ванной» комнаты,
 * «Шкаф» предмет, — потому что так думает человек, который обставляет
 * квартиру. `unknown` — законный ответ: слово для своего случая человек
 * может не подобрать, и тогда его несёт описание.
 */
export const OtherKind = z.enum([
  'kids',
  'hallway',
  'living',
  'bedroom',
  'workplace',
  'storage',
  'unknown',
])
export type OtherKind = z.infer<typeof OtherKind>

export const OtherDetails = z.strictObject({
  category: z.literal('other'),
  kind: OtherKind.nullable().default(null),
})

export const Details = z.discriminatedUnion('category', [
  KitchenDetails,
  WardrobeDetails,
  BathroomDetails,
  OtherDetails,
])
export type Details = z.infer<typeof Details>

/**
 * Шесть состояний (§4). Было восемь: `incomplete` и `unreached` убраны 18.09
 * вместе с операторским контуром дозвона — заявка без размера теперь уходит
 * мебельщикам как есть. Оба вернутся, когда появится дежурный: описаны в §9
 * контракта, а не оставлены в схеме пустыми. Держать статус, который никто
 * не присваивает, значит держать и тексты «мы вам позвоним» к нему.
 */
export const RequestStatus = z.enum([
  'unconfirmed',
  'qualified',
  'out_of_coverage',
  'routed',
  'quoted',
  'closed',
])
export type RequestStatus = z.infer<typeof RequestStatus>

export const FinishLevel = z.enum(['basic', 'medium', 'premium'])
export type FinishLevel = z.infer<typeof FinishLevel>

/**
 * Заявленный этап (решение PM 18.09). Нужен не метрике, а мебельщику:
 * по строке списка он решает, тратить ли двадцать минут на ответ. Заявленное
 * и фактическое — разные факты: человек говорит «уже ищу» и оставляет высоту
 * пустой, говорит «прикидываю» и вписывает метры с плана. Поэтому этап
 * хранится как ответ, а полнота вычисляется из полей — см. `tier`.
 *
 * Необязателен: вопрос стоит одного тапа и отправку не блокирует.
 */
export const Readiness = z.enum(['ready', 'planning'])
export type Readiness = z.infer<typeof Readiness>

/**
 * Полнота заявки — вычисляемое правило, а не хранимое поле, наравне
 * с `covered(city)` (§2, §4). Флаг завёл бы второй источник правды:
 * `complete: true` при пустом размере — состояние, законное для схемы
 * и бессмысленное по делу.
 *
 * `measured` — есть число: мебельщик называет цену не выезжая, это прежнее
 * определение квалифицированной заявки, по нему считается светофор.
 * `estimated` — числа нет, но есть снимки: вилка будет шире, но будет.
 * `blind` — ни числа, ни снимков: только описание.
 */
export const RequestTier = z.enum(['measured', 'estimated', 'blind'])
export type RequestTier = z.infer<typeof RequestTier>

export function tier(input: { mainSize: MainSize; photosCount: number }): RequestTier {
  if (input.mainSize.known) return 'measured'
  return input.photosCount > 0 ? 'estimated' : 'blind'
}

/**
 * Согласие на обработку ПДн (US-11). Хранится версия текста политики и время
 * отметки, а не булев флаг: доказывать придётся, с чем именно человек
 * согласился и когда, а текст политики со временем меняется.
 */
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
  finishLevel: FinishLevel.nullable().optional(),
  readiness: Readiness.nullable().optional(),
  /**
   * Обязателен с US-11: заявка без согласия не создаётся. Проверка живёт
   * в схеме, а не только на экране, — форму можно обойти инструментами
   * разработчика, схему нельзя (§5).
   */
  consent: Consent,
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
  details: Details,
  mainSize: MainSize,
  description: z.string(),
  city: City,
  district: z.string().nullable(),
  finishLevel: FinishLevel.nullable(),
  readiness: Readiness.nullable(),
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
  /** Число, а не снимки: «есть 3 фото» — всё, что нужно в списке. */
  photosCount: z.int().min(0),
  /**
   * Заявленный этап — ради него поле и заведено (18.09): по строке списка
   * мебельщик решает, браться ли за заявку без размеров, вместо того чтобы
   * открыть её и закрыть.
   */
  readiness: Readiness.nullable(),
  /** Отвечал уже или нет. Иначе мебельщик отвечает дважды (US-19a). */
  quotedByMe: z.boolean(),
})
export type RequestForMasterListItem = z.infer<typeof RequestForMasterListItem>

/**
 * Проекция строки кабинета заказчика (§5в, US-29) — то, что он видит
 * в списке своих заявок.
 *
 * `id` сюда не уходит и не уйдёт: заказчица работает с номером и токеном,
 * а внутренний идентификатор — дело сервера (§3). `phone` не уходит тем
 * более: человек и так знает свой номер, а лишняя копия ПДн в ответе —
 * лишнее место, где она утечёт.
 *
 * `token` здесь есть, и это осознанно: строка ведёт на ту же страницу
 * предложений, которой человек пользовался по ссылке из сообщения.
 * Уровень доверия тот же, что при выдаче токена в confirmOtp, только
 * теперь ключи ко всем своим заявкам приходят разом — и владельцу номера,
 * доказавшему владение кодом.
 */
export const RequestForClientListItem = z.strictObject({
  number: RequestNumber,
  token: Token,
  status: RequestStatus,
  createdAt: Iso,
  /** Когда ушла мебельщикам. Пусто, пока не маршрутизирована. */
  routedAt: Iso.nullable(),
  category: CategoryId,
  mainSize: MainSize,
  city: City,
  /** Сколько предложений уже пришло. Ноль — законное значение. */
  quotesCount: z.int().min(0),
})
export type RequestForClientListItem = z.infer<typeof RequestForClientListItem>

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
  /** Свободный текст из заявки — его мебельщик читает первым. */
  description: z.string(),
  city: City,
  district: z.string().nullable(),
  finishLevel: FinishLevel.nullable(),
  readiness: Readiness.nullable(),
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

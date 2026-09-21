// Коммерческое предложение (docs/api-contract.md §2, Quote).
import { z } from 'zod'
import { Iso, Phone, RequestId } from './primitives'

/** Только вилка: одиночное число не принимается (US-19a). */
export const QuotePrice = z
  .object({
    minKzt: z.int(),
    maxKzt: z.int(),
  })
  .refine((value) => value.maxKzt >= value.minKzt, {
    path: ['maxKzt'],
    message: 'Верхняя граница вилки не может быть меньше нижней',
  })
export type QuotePrice = z.infer<typeof QuotePrice>

/**
 * Кто ответил. Телефон здесь не утечка, а смысл предложения (US-24):
 * мастерская сама написала этой заказчице и знает, что по ответу позвонят.
 * В каталоге (§5, listMasters) телефона нет — там её никто не выбирал.
 */
export const QuoteMaster = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  phone: Phone,
})
export type QuoteMaster = z.infer<typeof QuoteMaster>

/**
 * Свободный текст внутри КП — `extra` и `excluded`. Обрезается по краям,
 * пустое после обрезки — ошибка. Та же дисциплина, что у описания заявки:
 * строка из пробелов не должна проходить как «что не входит».
 */
export const QuoteText = z.string().trim().min(1).max(2000)

/**
 * Позиции состава (§2, QuoteItem). Перечень закрытый и живёт здесь, а не
 * только в `src/questions`: сравнение матрицей (US-23) возможно лишь при
 * общем словаре. Будь это свободные строки, «Столешница» и «столешница
 * из камня» стали бы разными строками таблицы — ровно то, от чего уходим.
 *
 * **Перечень пересобран 18.09: части предмета убраны.** Были позиции
 * «Корпуса и полки», «Дверцы», «Двери», «Выдвижные ящики», «Штанги»,
 * «Тумба под раковину» — мебель без них не существует, и отметить их
 * мог только каждый. Позиция, которую отмечают все, ничего не сравнивает:
 * в матрице US-23 она даёт строку из одинаковых «есть» и занимает место.
 *
 * Осталось то, что у одной мастерской в цене, а у другой нет, — и это
 * ровно там, где прячется разница в сотни тысяч: мойка, доводчики,
 * подсветка и работы. Подъём на этаж заведён отдельно: это самая частая
 * доплата, о которой узнают в день доставки.
 *
 * **Пересобран второй раз 21.09, по знанию рынка (решение PM).** Сняты
 * четыре позиции и одна переехала:
 *
 * - `appliances` и `basin` — мебельщик технику и сантехнику не покупает.
 *   Он готовит мебель под встройку, и «встроенная техника в цене» обещала
 *   заказчице духовку за счёт цеха. Такое обещание дороже любой строки
 *   в таблице.
 * - `removal` и `cleanup` — вывоз старой мебели и уборка упаковки
 *   на стоимость не влияют, а строку в матрице занимают. Вывоз старой
 *   мебели при этом остаётся у мастерской услугой (`dismantle`, §2):
 *   там он про то, что мастерская умеет, а не про состав одной цены.
 * - `countertop` — не снята, а переехала в `QuoteMaterials`: столешница
 *   бывает ЛДСП, HPL и камень, и разница между ними больше, чем факт
 *   её наличия. Отметка «есть» у предмета, который есть у всех, ничего
 *   не сравнивает — то же основание, что у чистки 18.09.
 *
 * Подписи по-русски — в `src/questions/composition.ts`. Здесь только то,
 * чем обмениваются стороны.
 */
export const QuoteItem = z.enum([
  'sink',
  'softClose',
  'lighting',
  'mirror',
  'measure',
  'delivery',
  'lift',
  'assembly',
])
export type QuoteItem = z.infer<typeof QuoteItem>

/**
 * Материалы (§2, решение PM 21.09). Не отметки «есть», а выбор вида:
 * мебельщик называет, из чего сделает, и именно здесь лежит вторая
 * половина разницы в цене — первая в составе выше.
 *
 * Почему объект свойств, а не общий список отметок. «Плёнка» и «крашеный
 * МДФ» — взаимоисключающие ответы на один вопрос, и списком отметок
 * мебельщик мог бы выбрать оба. Свойство с вариантом этого не позволяет
 * и заодно даёт таблице сравнения три ровные строки вместо семи рваных.
 *
 * `null` законен и означает «не указано»: КП без материалов остаётся
 * законным КП — вилка и срок важнее, а требовать материалы значило бы
 * задержать ответ, ради скорости которого проба и затеяна.
 *
 * Названия здесь цеховые, потому что отмечает их мебельщик. Заказчице
 * те же значения показываются простыми словами — пара подписей живёт
 * в `src/questions/composition.ts` (§ Content: язык цеха ей не нужен).
 */
export const QuoteFacade = z.enum(['film', 'paintedMdf', 'acrylic', 'wood'])
export type QuoteFacade = z.infer<typeof QuoteFacade>

export const QuoteCountertop = z.enum(['chipboard', 'hpl', 'stone'])
export type QuoteCountertop = z.infer<typeof QuoteCountertop>

export const QuoteMaterials = z.object({
  facade: QuoteFacade.nullable().default(null),
  countertop: QuoteCountertop.nullable().default(null),
  /**
   * Защита от влаги под мойкой — плотная фольга или накладка. Булево,
   * а не вид: для заказчицы это «сделано или нет», а чем именно закрыт
   * низ тумбы, она не выбирает.
   */
  moistureGuard: z.boolean().default(false),
})
export type QuoteMaterials = z.infer<typeof QuoteMaterials>

/**
 * Состав решения структурой (решение PM 17.09, US-19a и US-23).
 *
 * `items` — отмеченное из перечня, минимум одна позиция: КП, где названа
 * цена и не названо, за что она, сравнивать не с чем. Повторы запрещены —
 * дубль в списке даёт две одинаковые строки в матрице сравнения.
 *
 * `extra` — дописанное своими словами. Не запасной выход, а измерительный
 * прибор: массовые записи туда вместо выбора означают, что перечень неверен.
 *
 * `excluded` — обязательное «что не входит». Обязательное потому, что именно
 * там чаще всего лежит разница в цене: замер, доставка и сборка у одного
 * внутри вилки, у другого сверху, и на дозвоне это худшая точка для новости.
 *
 * Принадлежность позиции категории здесь не проверяется (§2): набор под
 * категорию — вопрос формы, а не договора, и пересобирается он чаще.
 */
export const QuoteComposition = z.object({
  items: z
    .array(QuoteItem)
    .min(1)
    .refine((value) => new Set(value).size === value.length, {
      message: 'Позиция не может быть отмечена дважды',
    }),
  /** Из чего сделано — видами, а не отметками (см. QuoteMaterials). */
  materials: QuoteMaterials.default({ facade: null, countertop: null, moistureGuard: false }),
  extra: QuoteText.optional(),
  excluded: QuoteText,
})
export type QuoteComposition = z.infer<typeof QuoteComposition>

export const Quote = z.object({
  id: z.uuid(),
  requestId: RequestId,
  master: QuoteMaster,
  composition: QuoteComposition,
  price: QuotePrice,
  leadTimeDays: z.int().gt(0),
  photos: z.array(z.url()).max(3).default([]),
  sentAt: Iso,
  updatedAt: Iso.nullable(),
})
export type Quote = z.infer<typeof Quote>

/**
 * Тело createQuote (§5б). `master` сервер проставляет сам из сессии — иначе
 * мебельщик отправляет КП от чужого имени; `id`, `requestId` и `sentAt`
 * тоже его работа, а `updatedAt` появится только с US-19b (срез 3).
 *
 * Вилка обязательна и на сервере, не только в форме (US-19a): равенство
 * границ проходит — это твёрдая цена, законный ответ; чего схема не
 * пропускает, так это отсутствия одной из границ.
 */
export const CreateQuote = z.object({
  composition: QuoteComposition,
  price: QuotePrice,
  leadTimeDays: z.int().gt(0),
  photos: z.array(z.url()).max(3).optional(),
})
export type CreateQuote = z.infer<typeof CreateQuote>

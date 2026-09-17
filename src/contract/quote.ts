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
 * Подписи по-русски — в `src/questions/composition.ts`. Здесь только то,
 * чем обмениваются стороны.
 */
export const QuoteItem = z.enum([
  'bodies',
  'doors',
  'wardrobeDoors',
  'countertop',
  'drawers',
  'sink',
  'appliances',
  'softClose',
  'lighting',
  'shelfLighting',
  'rails',
  'mirror',
  'vanity',
  'basin',
  'cabinet',
  'measure',
  'delivery',
  'assembly',
  'removal',
])
export type QuoteItem = z.infer<typeof QuoteItem>

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

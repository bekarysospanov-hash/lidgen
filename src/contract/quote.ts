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
 * Текст КП: обрезается по краям, пустое после обрезки — ошибка. Та же
 * дисциплина, что у описания заявки: строка из пробелов не должна проходить
 * как «состав решения».
 */
export const QuoteText = z.string().trim().min(1).max(2000)

export const Quote = z.object({
  id: z.uuid(),
  requestId: RequestId,
  master: QuoteMaster,
  composition: QuoteText,
  materials: QuoteText,
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
  composition: QuoteText,
  materials: QuoteText,
  price: QuotePrice,
  leadTimeDays: z.int().gt(0),
  photos: z.array(z.url()).max(3).optional(),
})
export type CreateQuote = z.infer<typeof CreateQuote>

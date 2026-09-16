// Коммерческое предложение (docs/api-contract.md §2, Quote).
import { z } from 'zod'
import { Iso, RequestId } from './primitives'

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

export const QuoteMaster = z.object({ id: z.uuid(), name: z.string().min(1) })
export type QuoteMaster = z.infer<typeof QuoteMaster>

export const Quote = z.object({
  id: z.uuid(),
  requestId: RequestId,
  master: QuoteMaster,
  composition: z.string().min(1),
  materials: z.string().min(1),
  price: QuotePrice,
  leadTimeDays: z.int().gt(0),
  photos: z.array(z.url()).max(3).default([]),
  sentAt: Iso,
  updatedAt: Iso.nullable(),
})
export type Quote = z.infer<typeof Quote>

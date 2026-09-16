// Примитивы контракта (docs/api-contract.md §2, §3).
// Идентификаторы непрозрачны: фронт их не парсит, только проверяет форму.
import { z } from 'zod'

/** Телефон РК на проводе: всегда с плюсом, всегда 10 цифр после кода страны. */
export const Phone = z.string().regex(/^\+7\d{10}$/, 'Ожидается номер вида +77012345678')
export type Phone = z.infer<typeof Phone>

/** Технический идентификатор заявки. Не покидает сервер и кабинет мебельщика (§3). */
export const RequestId = z.uuid()
export type RequestId = z.infer<typeof RequestId>

/** Диктуемая по телефону метка заявки: только цифры и дефис, 4..12 символов (§3). */
export const RequestNumber = z
  .string()
  .min(4)
  .max(12)
  .regex(/^[0-9-]+$/, 'Только цифры и дефис')
export type RequestNumber = z.infer<typeof RequestNumber>

/** Секрет доступа к клиентской странице. Выдаётся только в ответе confirmOtp (§3). */
export const Token = z.string().regex(/^[A-Za-z0-9_-]{22,64}$/, 'Неверный формат токена')
export type Token = z.infer<typeof Token>

/** Время на проводе — ISO-8601 UTC (§1). */
export const Iso = z.iso.datetime()
export type Iso = z.infer<typeof Iso>

/** Код подтверждения: 4..6 цифр, длина приходит в OtpSent.codeLength. */
export const OtpCode = z.string().regex(/^\d{4,6}$/, 'Код состоит из 4–6 цифр')
export type OtpCode = z.infer<typeof OtpCode>

/** Описание заявки: обрезается по краям, пустое после обрезки — ошибка. */
export const Description = z.string().trim().min(1).max(2000)
export type Description = z.infer<typeof Description>

/** Метры вдоль стены: >0, ≤30, не больше двух знаков после запятой (§2, MainSize). */
export const Meters = z
  .number()
  .gt(0)
  .lte(30)
  .refine((value) => Number(value.toFixed(2)) === value, 'Не больше двух знаков после запятой')

/**
 * Главный размер. Ветка «пока не знаю» — валидный самостоятельный вариант
 * (US-05a), она же переводит заявку в incomplete (§4).
 */
export const MainSize = z.discriminatedUnion('known', [
  z.object({ known: z.literal(true), meters: Meters }),
  z.object({ known: z.literal(false) }),
])
export type MainSize = z.infer<typeof MainSize>

/** Список выбираемых городов — часть контракта. Покрытие — нет (§2, City). */
export const CityCode = z.enum(['almaty', 'astana', 'shymkent', 'other'])
export type CityCode = z.infer<typeof CityCode>

/** Город. Для code:'other' название обязательно — иначе заявку некуда отнести. */
export const City = z
  .object({
    code: CityCode,
    name: z.string().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.code === 'other' && (value.name === null || value.name.trim() === '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'Для города «другой» название обязательно',
      })
    }
  })
export type City = z.infer<typeof City>

// Подтверждение номера (docs/api-contract.md §5).
import { z } from 'zod'
import { OtpCode, Phone, RequestId } from './primitives'

/** Канал доставки кода. Какой именно — решает сервер, фронт его показывает. */
export const OtpChannel = z.enum(['sms', 'whatsapp', 'telegram'])
export type OtpChannel = z.infer<typeof OtpChannel>

/** Ответ на отправку кода: и при createRequest, и при resendOtp. */
export const OtpSent = z.object({
  channel: OtpChannel,
  codeLength: z.int().min(4).max(6),
  retryAfterSec: z.int().min(0),
})
export type OtpSent = z.infer<typeof OtpSent>

/**
 * Ответ resendLink (§5, US-21). Тела «нашли заявку» или «не нашли» здесь нет
 * намеренно: иначе форма становится проверкой «оставлял ли этот человек
 * заявку», то есть перечислением по номеру телефона.
 *
 * `retryAfterSec` возвращается всегда, а не только при отказе: экран должен
 * уметь сказать, через сколько можно повторить, не дожидаясь RATE_LIMITED.
 */
export const LinkResent = z.object({
  channel: OtpChannel,
  retryAfterSec: z.int().min(0),
})
export type LinkResent = z.infer<typeof LinkResent>

/**
 * Логический вход resendLink: только номер. Кода подтверждения нет — сообщение
 * уходит на сам номер, владение телефоном и есть подтверждение.
 */
export const ResendLinkInput = z.object({ phone: Phone })
export type ResendLinkInput = z.infer<typeof ResendLinkInput>

/**
 * Логический вход resendOtp. requestId приходит из {id} пути, тело запроса
 * пустое — схема описывает вход операции, не форму тела на проводе (§5).
 */
export const ResendOtpInput = z.object({ requestId: RequestId })
export type ResendOtpInput = z.infer<typeof ResendOtpInput>

/** Вход confirmOtp: requestId из пути, code — тело запроса. */
export const ConfirmOtpInput = z.object({ requestId: RequestId, code: OtpCode })
export type ConfirmOtpInput = z.infer<typeof ConfirmOtpInput>

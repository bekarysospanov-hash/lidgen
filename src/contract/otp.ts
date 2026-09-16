// Подтверждение номера (docs/api-contract.md §5).
import { z } from 'zod'
import { OtpCode, RequestId } from './primitives'

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
 * Логический вход resendOtp. requestId приходит из {id} пути, тело запроса
 * пустое — схема описывает вход операции, не форму тела на проводе (§5).
 */
export const ResendOtpInput = z.object({ requestId: RequestId })
export type ResendOtpInput = z.infer<typeof ResendOtpInput>

/** Вход confirmOtp: requestId из пути, code — тело запроса. */
export const ConfirmOtpInput = z.object({ requestId: RequestId, code: OtpCode })
export type ConfirmOtpInput = z.infer<typeof ConfirmOtpInput>

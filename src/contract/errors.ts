// Конверт ошибок (docs/api-contract.md §6). Клиент ключуется по code,
// HTTP-статус вторичен.
import { z } from 'zod'

export const ErrorCode = z.enum([
  'VALIDATION_FAILED',
  'REQUEST_NOT_FOUND',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_ATTEMPTS_EXCEEDED',
  'OTP_RESEND_TOO_SOON',
  'ALREADY_CONFIRMED',
  'TOKEN_INVALID',
  'RATE_LIMITED',
  'INTERNAL',
])
export type ErrorCode = z.infer<typeof ErrorCode>

export const ValidationField = z.object({ path: z.string(), message: z.string() })
export type ValidationField = z.infer<typeof ValidationField>

const message = z.string()

/**
 * OTP_EXPIRED и OTP_ATTEMPTS_EXCEEDED зарезервированы: прод включает защиты,
 * не меняя контракт (§6, резерв). Мок их не эмитит.
 */
export const ApiErrorBody = z.discriminatedUnion('code', [
  z.object({
    code: z.literal('VALIDATION_FAILED'),
    message,
    fields: z.array(ValidationField),
  }),
  z.object({ code: z.literal('REQUEST_NOT_FOUND'), message }),
  z.object({ code: z.literal('OTP_INVALID'), message }),
  z.object({ code: z.literal('OTP_EXPIRED'), message }),
  z.object({
    code: z.literal('OTP_ATTEMPTS_EXCEEDED'),
    message,
    retryAfterSec: z.int().min(0),
  }),
  z.object({
    code: z.literal('OTP_RESEND_TOO_SOON'),
    message,
    retryAfterSec: z.int().min(0),
  }),
  z.object({ code: z.literal('ALREADY_CONFIRMED'), message }),
  z.object({ code: z.literal('TOKEN_INVALID'), message }),
  z.object({ code: z.literal('RATE_LIMITED'), message, retryAfterSec: z.int().min(0) }),
  z.object({ code: z.literal('INTERNAL'), message }),
])
export type ApiErrorBody = z.infer<typeof ApiErrorBody>

export const ErrorEnvelope = z.object({ error: ApiErrorBody })
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>

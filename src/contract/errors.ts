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
  'UNAUTHORIZED',
  'MASTER_NOT_FOUND',
  'MASTER_UNAUTHORIZED',
  'NOT_ROUTED_TO_YOU',
  'QUOTE_ALREADY_SENT',
  'QUOTE_NOT_FOUND',
  'CARD_NOT_PUBLISHED',
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
  /**
   * Сессии нет, она протухла или отозвана — любая зона кабинета (§5в, 20.09).
   * Отделён от MASTER_UNAUTHORIZED намеренно: «войдите заново» и «этот
   * кабинет не для вас» — разные сообщения и разные выходы.
   */
  z.object({ code: z.literal('UNAUTHORIZED'), message }),
  /** Кабинет мебельщика (§5б, §6). */
  z.object({ code: z.literal('MASTER_NOT_FOUND'), message }),
  /**
   * Сессия есть, роли master в ней нет. С одной дверью (20.09) этот код
   * сузился: раньше он значил и «не вошёл», и «не мебельщик», и экран
   * на оба случая отвечал одинаково — отправлял на вход того, кто уже вошёл.
   */
  z.object({ code: z.literal('MASTER_UNAUTHORIZED'), message }),
  /** Чужая заявка и несуществующая отвечают одинаково — иначе id перебирается. */
  z.object({ code: z.literal('NOT_ROUTED_TO_YOU'), message }),
  z.object({ code: z.literal('QUOTE_ALREADY_SENT'), message }),
  /** US-19b: правится только существующее своё КП. */
  z.object({ code: z.literal('QUOTE_NOT_FOUND'), message }),
  /** US-20: карточка не черновик мебельщика, а наша публикация с его согласия. */
  z.object({ code: z.literal('CARD_NOT_PUBLISHED'), message }),
])
export type ApiErrorBody = z.infer<typeof ApiErrorBody>

export const ErrorEnvelope = z.object({ error: ApiErrorBody })
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>

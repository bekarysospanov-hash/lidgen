// Единственный тип ошибки, который видят экраны. Сервер отвечает конвертом
// { error: { code, message, ...поля кода } } (docs/api-contract.md §6);
// клиент ключуется по code, HTTP-статус вторичен.
import type { ApiErrorBody, ErrorCode } from '../contract'

/**
 * Клиентские коды — не часть wire-контракта, живут только на фронте (§6):
 * NETWORK — запрос не дошёл или не вернулся;
 * CONTRACT_VIOLATION — ответ пришёл, но не прошёл zod-валидацию по контракту.
 */
export type ClientErrorCode = 'NETWORK' | 'CONTRACT_VIOLATION'

export type ApiErrorCode = ErrorCode | ClientErrorCode

/** Доп. поля кода, уже разобранные: retryAfterSec, fields и т.п. */
export type ApiErrorDetails = Record<string, unknown>

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly details: ApiErrorDetails | undefined
  readonly cause: unknown

  constructor(code: ApiErrorCode, message: string, details?: ApiErrorDetails, cause?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.cause = cause
  }

  /** Конверт с провода → ApiError с тем же code и разобранными полями. */
  static fromBody(body: ApiErrorBody): ApiError {
    const { code, message, ...details } = body
    return new ApiError(code, message, Object.keys(details).length > 0 ? details : undefined)
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Вход не прошёл контракт — и мок, и http обязаны ответить одинаково:
 * VALIDATION_FAILED с разложенными по путям полями (docs/api-contract.md §6).
 * Живёт рядом с ApiError, а не копией в каждой реализации: разъехавшиеся
 * копии этой функции означали бы, что мок и сервер сообщают об ошибке
 * по-разному — ровно то, чего конвенция «моки реализуют контракт» не допускает.
 */
export function validationFailed(error: unknown): ApiError {
  const issues =
    error && typeof error === 'object' && 'issues' in error
      ? ((error as { issues: { path: PropertyKey[]; message: string }[] }).issues ?? [])
      : []
  return new ApiError('VALIDATION_FAILED', 'Заявка не прошла проверку', {
    fields: issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  })
}

// Единственный тип, который реализуют и mockApi, и httpApi. Подмена мока
// на реальный бэкенд — переключатель в client.ts, а не переписывание экранов
// (CLAUDE.md, docs/api-contract.md §5).
import type {
  ConfirmOtpInput,
  CreateRequest,
  OtpSent,
  RequestConfirmed,
  RequestCreated,
  RequestForClient,
} from '../contract'

/**
 * Вход операций принимается «сырым» и валидируется схемой контракта внутри
 * реализации: и мок, и http разбирают его одной и той же схемой, а не верят
 * вызывающему на слово. CreateRequestInput сохранён как подсказка формы.
 */
export type CreateRequestInput = CreateRequest | Record<string, unknown>
export type ResendOtpInputLike = { requestId: string } | Record<string, unknown>
export type ConfirmOtpInputLike = ConfirmOtpInput | Record<string, unknown>

/** Четыре операции скелета (docs/api-contract.md §5). Всё остальное — §9. */
export interface Api {
  /** POST /api/requests — создаёт заявку и отправляет первый код. */
  createRequest(input: CreateRequestInput): Promise<RequestCreated>
  /** POST /api/requests/{id}/otp/resend — единственный способ получить код повторно. */
  resendOtp(input: ResendOtpInputLike): Promise<OtpSent>
  /** POST /api/requests/{id}/otp/confirm — классифицирует статус и выдаёт token. */
  confirmOtp(input: ConfirmOtpInputLike): Promise<RequestConfirmed>
  /** GET /api/client/requests/{token} — проекция без id и phone. */
  getRequestByToken(token: string): Promise<RequestForClient>
}

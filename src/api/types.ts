// Единственный тип, который реализуют и mockApi, и httpApi. Подмена мока
// на реальный бэкенд — переключатель в client.ts, а не переписывание экранов
// (CLAUDE.md, docs/api-contract.md §5).
import type {
  ConfirmOtpInput,
  CreateQuote,
  CreateRequest,
  MasterConfirmCodeInput,
  MasterRequestCodeInput,
  MasterSession,
  OtpSent,
  SendEventsInput,
  Photo,
  Quote,
  RequestConfirmed,
  RequestCreated,
  RequestForClient,
  RequestForMaster,
  RequestForMasterListItem,
} from '../contract'

/**
 * Вход операций принимается «сырым» и валидируется схемой контракта внутри
 * реализации: и мок, и http разбирают его одной и той же схемой, а не верят
 * вызывающему на слово. CreateRequestInput сохранён как подсказка формы.
 */
export type CreateRequestInput = CreateRequest | Record<string, unknown>
export type ResendOtpInputLike = { requestId: string } | Record<string, unknown>
export type ConfirmOtpInputLike = ConfirmOtpInput | Record<string, unknown>

/**
 * Загрузка снимка. Наружу отдаётся File — реальный бэкенд получит его
 * multipart-ом, мок положит в память вкладки. Экран в обоих случаях работает
 * с готовым Photo и про способ доставки не знает.
 */
export type UploadPhotoInputLike = File

/** Вход операций кабинета — так же «сырой», как и остальные (§5б). */
export type MasterCodeInputLike = MasterRequestCodeInput | Record<string, unknown>
export type MasterConfirmInputLike = MasterConfirmCodeInput | Record<string, unknown>
export type CreateQuoteInputLike = CreateQuote | Record<string, unknown>
export type SendEventsInputLike = SendEventsInput | Record<string, unknown>

/**
 * Одиннадцать операций скелета: шесть публичных (§5) и пять в кабинете
 * мебельщика (§5б). Всё остальное — §9.
 */
export interface Api {
  /** POST /api/requests — создаёт заявку и отправляет первый код. */
  createRequest(input: CreateRequestInput): Promise<RequestCreated>
  /** POST /api/requests/{id}/otp/resend — единственный способ получить код повторно. */
  resendOtp(input: ResendOtpInputLike): Promise<OtpSent>
  /** POST /api/requests/{id}/otp/confirm — классифицирует статус и выдаёт token. */
  confirmOtp(input: ConfirmOtpInputLike): Promise<RequestConfirmed>
  /** GET /api/client/requests/{token} — проекция без id и phone. */
  getRequestByToken(token: string): Promise<RequestForClient>
  /** POST /api/photos — multipart, один файл за вызов (US-10, §5). */
  uploadPhoto(file: UploadPhotoInputLike): Promise<Photo>
  /**
   * DELETE /api/photos/{id} — снятый снимок исчезает и на сервере.
   * Без этой операции отвергнутые файлы копятся в хранилище, а во вкладке
   * остаются висеть blob:-адреса, каждый до 10 МБ (US-10, §5).
   */
  deletePhoto(id: string): Promise<void>
  /**
   * POST /api/events — воронка US-25a и путь заявки US-25b (§5).
   * Единственная операция, отказ которой экран обязан проглотить молча:
   * наблюдение не должно ломать продукт.
   */
  sendEvents(input: SendEventsInputLike): Promise<void>

  // --- Кабинет мебельщика (§5б). masterToken уходит заголовком
  // Authorization: Bearer, а не в пути и не в теле: в URL он попал бы
  // в логи прокси и в Referer, а за ним — список чужих заявок (§3).

  /** POST /api/master/otp/request — код на номер мебельщика (US-17). */
  masterRequestCode(input: MasterCodeInputLike): Promise<OtpSent>
  /** POST /api/master/otp/confirm — выдаёт masterToken на 12 часов. */
  masterConfirmCode(input: MasterConfirmInputLike): Promise<MasterSession>
  /** GET /api/master/requests — маршрутизированные ему, новые первыми (US-18). */
  listRequestsForMaster(token: string): Promise<RequestForMasterListItem[]>
  /** GET /api/master/requests/{id} — карточка, по ней называется вилка. */
  getRequestForMaster(token: string, id: string): Promise<RequestForMaster>
  /** POST /api/master/requests/{id}/quote — одно КП на заявку (US-19a). */
  createQuote(token: string, id: string, input: CreateQuoteInputLike): Promise<Quote>
}

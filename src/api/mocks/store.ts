// Состояние мока: заявки, токены, события. Всё в памяти процесса —
// никакого localStorage и sessionStorage (спека §8, US-11, CLAUDE.md).
import type {
  ActorRole,
  City,
  Consent,
  Details,
  Event,
  EventType,
  FinishLevel,
  MainSize,
  Photo,
  Quote,
  RequestStatus,
  Source,
} from '../../contract'
import { resetPhotos } from './photos'

/**
 * Полная серверная запись (§2). Телефон хранится здесь и никогда не попадает
 * в RequestForClient — проекции собираются при отдаче, а не лежат готовыми.
 */
export interface RequestRecord {
  id: string
  number: string
  status: RequestStatus
  createdAt: string
  phoneConfirmedAt: string | null
  routedAt: string | null
  completedManually: boolean
  details: Details
  mainSize: MainSize
  description: string
  city: City
  district: string | null
  deadline: string | null
  finishLevel: FinishLevel | null
  phone: string
  consent: Consent | null
  source: Source | null
  clientRequestId: string | null
  /** Появляется только после confirmOtp (§3). */
  token: string | null
  /** Когда уходил последний код — от него считается кулдаун resendOtp. */
  otpSentAt: string
  /** Первое открытие клиентской страницы; повторные открытия его не двигают. */
  clientFirstOpenedAt: string | null
  /** US-10 — снимки помещения; пустой список законен (§5). */
  photos: Photo[]
  quotes: Quote[]
}

const requests = new Map<string, RequestRecord>()
const tokens = new Map<string, string>()
const byClientRequestId = new Map<string, string>()
const events: Event[] = []
let numberCounter = 0

export function reset(): void {
  // Снимки убираются вместе со всем остальным: без этого blob:-адреса
  // прошлого прогона остаются висеть в памяти вкладки.
  resetPhotos()
  requests.clear()
  tokens.clear()
  byClientRequestId.clear()
  events.length = 0
  numberCounter = 0
}

export function putRequest(record: RequestRecord): void {
  requests.set(record.id, record)
  if (record.clientRequestId) byClientRequestId.set(record.clientRequestId, record.id)
  if (record.token) tokens.set(record.token, record.id)
}

/** Интроспекция для тестов и отладки — не часть контракта. */
export function getRequestRecord(id: string): RequestRecord | undefined {
  return requests.get(id)
}

export function findByClientRequestId(clientRequestId: string): RequestRecord | undefined {
  const id = byClientRequestId.get(clientRequestId)
  return id ? requests.get(id) : undefined
}

export function findByToken(token: string): RequestRecord | undefined {
  const id = tokens.get(token)
  return id ? requests.get(id) : undefined
}

export function listEvents(): Event[] {
  return [...events]
}

/**
 * Роль указывает вызывающий, а не функция: по этим событиям считается воронка
 * US-25a, и «кто это сделал» там содержательно. Отправку заявки, ввод кода
 * и открытие клиентской страницы порождает заказчица — записывать их как
 * 'system' значило бы стереть в воронке единственного живого участника.
 * Автоматическую рассылку кода при createRequest, наоборот, никто не просил:
 * её делает сервер, и это честный 'system'.
 */
export function addEvent(
  type: EventType,
  requestId: string | null,
  actorRole: ActorRole,
  payload?: Record<string, unknown>,
): Event {
  const event: Event = {
    id: newId(),
    type,
    at: new Date().toISOString(),
    requestId,
    actor: { role: actorRole },
    ...(payload ? { payload } : {}),
  }
  events.push(event)
  return event
}

export function newId(): string {
  return crypto.randomUUID()
}

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'

/** 32 символа алфавита токена = 192 бита энтропии, требование §3 — ≥128. */
export function newToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte & 63]).join('')
}

// PROBE: мок-нумерация ГГММ-NNN — стенд-ин серверного правила нумерации
// (§10). Реальный формат бэкенд выбирает сам, фронт его не парсит (§1).
export function nextNumber(now: Date): string {
  numberCounter += 1
  const yy = String(now.getFullYear() % 100).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${yy}${mm}-${String(numberCounter).padStart(3, '0')}`
}

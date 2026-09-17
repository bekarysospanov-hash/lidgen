// События воронки (docs/api-contract.md §2, Event).
import { z } from 'zod'
import { Iso, RequestId } from './primitives'

export const EventType = z.enum([
  'visit',
  'continue_clicked',
  'category_selected',
  'required_filled',
  'request_submitted',
  'otp_requested',
  'otp_confirmed',
  'routed',
  'master_opened',
  'quote_sent',
  'client_page_opened',
  'contact_made',
  'manual_completion',
  'request_closed',
  /** US-21: заказчица попросила прислать ссылку заново. */
  'link_resent',
])
export type EventType = z.infer<typeof EventType>

export const ActorRole = z.enum(['client', 'master', 'operator', 'system'])
export type ActorRole = z.infer<typeof ActorRole>

export const Actor = z.object({ role: ActorRole, id: z.string().optional() })
export type Actor = z.infer<typeof Actor>

export const Event = z.object({
  id: z.uuid(),
  type: EventType,
  at: Iso,
  /** null для событий без привязки к заявке (visit). */
  requestId: RequestId.nullable(),
  actor: Actor,
  /** Обязателен для событий воронки до отправки заявки (US-25a). */
  sessionId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})
export type Event = z.infer<typeof Event>

/** События воронки ДО отправки заявки: у них нет requestId, есть sessionId. */
export const FUNNEL_EVENTS = [
  'visit',
  'continue_clicked',
  'category_selected',
  'required_filled',
] as const satisfies readonly EventType[]

const FUNNEL_EVENT_TYPES: ReadonlySet<EventType> = new Set(FUNNEL_EVENTS)

/**
 * Что фронт отправляет в POST /api/events (§5): событие без `id` и без `at` —
 * оба ставит сервер. Время клиента доверия не заслуживает: часы на телефоне
 * сбиты чаще, чем кажется, и воронка по ним раскладывается неправильно.
 */
export const EventInput = Event.omit({ id: true, at: true }).superRefine((value, ctx) => {
  // Контракт §5: у событий до отправки заявки нет requestId, и без sessionId
  // их не с чем связать — воронка рассыпается на несвязанные счётчики.
  if (FUNNEL_EVENT_TYPES.has(value.type) && !value.sessionId) {
    ctx.addIssue({
      code: 'custom',
      path: ['sessionId'],
      message: 'Для событий воронки sessionId обязателен',
    })
  }
})
export type EventInput = z.infer<typeof EventInput>

/** Тело запроса: пачкой, чтобы не бить по сети на каждое нажатие. */
export const SendEventsInput = z.object({
  events: z.array(EventInput).min(1).max(50),
})
export type SendEventsInput = z.infer<typeof SendEventsInput>


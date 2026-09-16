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

// Маршрутизация заявки мебельщикам (US-14, docs/api-contract.md §2 Routing, §4).
//
// PROBE в двух местах, оба названы в §10: получатели отбираются по порядку
// списка (на проде — очередь, рейтинг или ручной отбор дежурным), и рассылка
// происходит синхронно внутри confirmOtp, потому что сервера, который сделал
// бы это отдельным шагом с уведомлениями (US-15), у пробы нет.
import { ROUTING_MAX_MASTERS, Routing } from '../../contract'
import { listAcceptingIn } from './masters'
import { addEvent, onReset, type RequestRecord } from './store'

const routings = new Map<string, Routing>()

export function resetRoutings(): void {
  routings.clear()
}

/**
 * Маршрутизирует только qualified (§4) — ни incomplete, ни out_of_coverage.
 * Заявка получает routedAt и статус routed тем же вызовом; ноль получателей
 * по построению невозможен: город без мебельщиков на приёме не покрыт,
 * и такая заявка получила бы out_of_coverage ещё при классификации.
 */
export function routeRequest(record: RequestRecord, now: Date): Routing | undefined {
  if (record.status !== 'qualified') return undefined

  const recipients = listAcceptingIn(record.city.code).slice(0, ROUTING_MAX_MASTERS)
  if (recipients.length === 0) return undefined

  const routing = Routing.parse({
    requestId: record.id,
    masterIds: recipients.map((master) => master.id),
    routedAt: now.toISOString(),
  })
  routings.set(record.id, routing)

  record.routedAt = routing.routedAt
  record.status = 'routed'

  // Рассылку делает сервер, её никто не просил — роль system, как у отправки
  // кода при создании заявки. Уведомление в мессенджер (US-15) — серверная
  // работа без операции в контракте; здесь от неё остаётся только событие.
  addEvent('routed', record.id, 'system', { masterIds: routing.masterIds })

  return routing
}

export function routingFor(requestId: string): Routing | undefined {
  return routings.get(requestId)
}

/** Заявки этого мебельщика, новые первыми — сортировка часть контракта (§5б). */
export function listRoutedTo(masterId: string): Routing[] {
  return [...routings.values()]
    .filter((routing) => routing.masterIds.includes(masterId))
    .sort((a, b) => b.routedAt.localeCompare(a.routedAt))
}

onReset(resetRoutings)

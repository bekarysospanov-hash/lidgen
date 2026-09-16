// Покрытие города — свойство серверных данных, не контракта (§2 City, §4).
// До US-14 здесь стояла константа из трёх городов; теперь у покрытия есть
// источник: город покрыт, если в нём есть хотя бы один мебельщик на приёме.
import type { CityCode } from '../../contract'
import { listAcceptingIn } from './masters'

/** Есть ли в городе мебельщики на приёме. */
export function covered(code: CityCode): boolean {
  return listAcceptingIn(code).length > 0
}

// PROBE: мок-покрытие городов — стенд-ин серверных данных «мебельщики
// на приёме» (§2 City, §10). На проде покрытие считается по списку
// мебельщиков, принимающих заявки (US-14), а не по константе.
import type { CityCode } from '../../contract'

const COVERED: ReadonlySet<CityCode> = new Set<CityCode>(['almaty', 'astana', 'shymkent'])

/** Есть ли в городе мебельщики на приёме — свойство данных, не контракта. */
export function covered(code: CityCode): boolean {
  return COVERED.has(code)
}

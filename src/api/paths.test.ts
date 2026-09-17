// Сверка путей: ходит ли http-клиент туда, куда обещает документ контракта.
//
// Зачем отдельным тестом. http.ts восемнадцать операций проверяет против
// подменённого fetch — то есть против собственных ожиданий. Живого сервера
// он не видел ни разу (долг записан в HANDOVER.md), и первое расхождение
// вида «фронт стучится в /api/master/card, а бэкенд поднял /api/masters/card»
// вскрылось бы на стыковке, в самый дорогой момент.
//
// Этот тест закрывает ту часть долга, которую можно закрыть без сервера:
// адреса и методы в коде сверяются со строками «HTTP | METHOD /path» из
// docs/api-contract.md. Документ здесь — источник правды, код — проверяемое.
//
// Чего тест не заменяет: форм тел запросов и ответов, кодов состояния,
// заголовков. Это увидит только первая стыковка.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..')

/** Параметр в адресе приводится к одному виду: {id} и ${...} — одно и то же. */
function normalize(path: string): string {
  return path.replace(/\$\{[^}]*\}/g, '{id}').replace(/\{[a-zA-Z]+\}/g, '{id}')
}

/** Пары «метод + путь», обещанные документом (§5 и §5б). */
function fromContract(): Set<string> {
  const doc = readFileSync(join(ROOT, 'docs', 'api-contract.md'), 'utf8')
  const found = new Set<string>()
  const rows = doc.matchAll(/^\|\s*HTTP\s*\|\s*`([A-Z]+)\s+([^`]+)`\s*\|/gm)
  for (const [, method, path] of rows) found.add(`${method} ${normalize(path.trim())}`)
  return found
}

/** Пары «метод + путь», на которые реально ходит клиент. */
function fromClient(): Set<string> {
  const source = readFileSync(join(ROOT, 'src', 'api', 'http.ts'), 'utf8')
  const found = new Set<string>()
  // call('/api/...', { method: 'POST' | ... }) — и в кавычках, и шаблоном.
  const calls = source.matchAll(/call\(\s*[`']([^`']+)[`']\s*,\s*\{\s*method:\s*'([A-Z]+)'/g)
  for (const [, path, method] of calls) found.add(`${method} ${normalize(path)}`)
  return found
}

describe('пути http-клиента против документа контракта', () => {
  const contract = fromContract()
  const client = fromClient()

  it('документ вообще разобрался — иначе тест проходил бы на пустоте', () => {
    expect(contract.size).toBeGreaterThan(10)
    expect(client.size).toBeGreaterThan(10)
  })

  it('клиент не ходит никуда, чего не обещает документ', () => {
    const extra = [...client].filter((route) => !contract.has(route))
    expect(extra).toEqual([])
  })

  it('каждая операция документа вызывается клиентом', () => {
    // Исключений нет: все восемнадцать операций §5 и §5б реализованы.
    // Появится операция «на будущее» — тест заставит либо реализовать её,
    // либо записать в §9, где живёт зарезервированное.
    const missing = [...contract].filter((route) => !client.has(route))
    expect(missing).toEqual([])
  })
})

#!/usr/bin/env node
// Выжимка из DESIGN.md для хука: печатается в контекст перед каждой записью
// файла интерфейса. Смысл не в напоминании «прочитай файл», а в том, что имена
// токенов и запреты оказываются перед глазами в момент записи — пропустить шаг
// физически нельзя.
//
// Читает DESIGN.md, а не повторяет его. Файл поменяется — выжимка поедет следом.
// Держать короткой: она уходит в контекст на КАЖДУЮ запись.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const src = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8')

const fm = src.split('\n---')[0].replace(/^---\n/, '')
const prose = src.slice(src.indexOf('\n---', 4))

/** Ключи верхнего уровня внутри секции frontmatter. */
function keysOf(section) {
  const lines = fm.split('\n')
  const start = lines.findIndex((l) => l === `${section}:`)
  if (start === -1) return []
  const out = []
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^ {2}([\w-]+):/)
    if (m) out.push(m[1])
    else if (/^\S/.test(lines[i])) break
  }
  return out
}

/** Значение вложенного поля: typography.body.fontSize и т.п. */
function nested(section, key, field) {
  const re = new RegExp(`^ {2}${key}:\\n(?: {4}.*\\n)*? {4}${field}: (.+)$`, 'm')
  const m = fm.match(re)
  return m ? m[1].trim() : ''
}

/** Плоское значение: rounded.sm, spacing.lg. */
function flat(section, key) {
  const lines = fm.split('\n')
  const start = lines.findIndex((l) => l === `${section}:`)
  if (start === -1) return ''
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(new RegExp(`^ {2}${key}: (.+)$`))
    if (m) return m[1].trim()
    if (/^\S/.test(lines[i])) break
  }
  return ''
}

const colors = keysOf('colors')
const type = keysOf('typography')
const rounded = keysOf('rounded')
const spacing = keysOf('spacing')
const components = keysOf('components')

// Раздел запретов из прозы — он и есть то, что нарушают чаще всего.
const dontsBlock = prose.match(/### Don't\n([\s\S]*?)(?:\n## |\n$|$)/)
const donts = (dontsBlock ? dontsBlock[1] : '')
  .split('\n')
  .filter((l) => l.startsWith('- '))
  .map((l) => '  ' + l.slice(2).replace(/Никогда не /, '').trim())

const line = (label, items) => `  ${label.padEnd(11)} ${items.join(' · ')}`

console.log(`
DESIGN.md — выжимка. Полный файл читать перед проектированием: ${join(ROOT, 'DESIGN.md')}

ЦВЕТ — только через токены, литералы в коде запрещены
${line('поверхности', colors.filter((c) => c.startsWith('surface')))}
${line('текст', colors.filter((c) => c.startsWith('on-') || c === 'outline'))}
${line('смыслы', colors.filter((c) => ['primary', 'accent', 'link', 'error'].includes(c)))}
  primary — действие и успех · accent — акцент, НЕ интерактивен
  link — только ссылки · error — только ошибка

ТИПОГРАФИКА — регистр предложный, капса нет
${type.map((t) => `  ${t.padEnd(11)} ${nested('typography', t, 'fontSize')} / ${nested('typography', t, 'fontWeight')}`).join('\n')}

РАДИУС
${rounded.map((r) => `  ${r.padEnd(11)} ${flat('rounded', r)}`).join(' ')}
  вложенные дуги концентричны: внутренний = внешний − отступ

ОТСТУПЫ
  ${spacing.map((s) => `${s}:${flat('spacing', s)}`).join(' · ')}

КОМПОНЕНТЫ СИСТЕМЫ
  ${components.join(' · ')}

НЕЛЬЗЯ
${donts.join('\n')}

Проверка после записи: npm run design:check
`.trim())

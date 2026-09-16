#!/usr/bin/env node
// Третий контур проверки: следовал ли КОД файлу DESIGN.md.
// Линтер проверяет сам файл, hallmark audit — анти-паттерны,
// а это ловит цвета и шрифты, заведённые мимо токенов.
// Правило проекта: цвет и шрифт в коде — только через токен.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN = ['src']
// Единственный файл, где сырые значения законны: он сгенерирован из DESIGN.md.
const ALLOW = new Set(['src/design-tokens.css'])

// Запрещённые утилиты Tailwind. Выведены из раздела Don'ts в DESIGN.md.
// Нужны потому, что Tailwind v4 свои дефолты нашими токенами НЕ заменяет,
// а дополняет: объявленный единственный радиус `none` не отменяет rounded-xl.
// Проверка значений (RULES ниже) такие нарушения не видит — нарушитель
// пользуется легальными утилитами, просто запрещёнными нашей системой.
const BANNED = [
  // full разрешён только точке выбора и чипсу (§ Shapes). Отличить их от
  // круглой кнопки регуляркой нельзя — это правило прозой, и держится оно
  // на том, что DESIGN.md прочитан. Здесь закрыта лишь шкала: промежуточных
  // ступеней между 8 и full не бывает.
  { re: /\brounded-(?!none\b|sm\b|md\b|full\b)[a-z0-9[\]]+/g,
    why: 'ступени радиуса: 0 фото и линии, 4 кнопки и поля, 8 карточки, full точка и чипс — DESIGN.md § Shapes' },
  { re: /\brounded(?![-a-z0-9])/g,
    why: 'голый rounded — это дефолт Tailwind мимо шкалы — DESIGN.md § Shapes' },
  { re: /\bfont-(bold|extrabold|black|light|extralight|thin)\b/g,
    why: 'шкала весов 400 / 500 / 600, крайних нет — DESIGN.md § Typography' },
  { re: /\b(drop-)?shadow-[a-z0-9[\]]+/g,
    why: 'теней нет, высота передаётся цветом поверхности — DESIGN.md § Elevation' },
  { re: /\bbg-gradient-[a-z-]+/g, why: 'градиентов нет — DESIGN.md § Elevation' },
  { re: /\bitalic\b/g, why: 'курсива нет — DESIGN.md § Don\'ts' },
  { re: /\buppercase\b/g,
    why: 'регистр предложный везде, капса нет — DESIGN.md § Typography' },
  { re: /\bbg-error\b/g,
    why: 'красный только линией и текстом, заливкой никогда — DESIGN.md § Colors' },
  { re: /\bbg-link\b/g,
    why: 'синий только у ссылок, кнопка синей не бывает — DESIGN.md § Colors' },
]

const RULES = [
  { name: 'hex-цвет', re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'oklch()', re: /\boklch\(/g },
  { name: 'rgb()/rgba()', re: /\brgba?\(/g },
  { name: 'hsl()/hsla()', re: /\bhsla?\(/g },
  // Литеральный шрифт. Ссылка на токен — font-family: var(--font-…) — законна.
  { name: 'font-family литералом', re: /font-family\s*:(?![^;\n]*var\()/g },
]

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?|css)$/.test(e)) out.push(p)
  }
  return out
}

const findings = []
for (const base of SCAN) {
  for (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file)
    if (ALLOW.has(rel)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return
      for (const r of RULES) {
        r.re.lastIndex = 0
        if (r.re.test(line)) findings.push({ file: rel, line: i + 1, rule: r.name, text: line.trim().slice(0, 90) })
      }
      // Явное исключение: пометка design-ok на этой строке или на предыдущей.
      // Пометка обязана называть причину — молчаливых исключений не бывает.
      if (/design-ok:/.test(line) || (i > 0 && /design-ok:/.test(lines[i - 1]))) return
      for (const b of BANNED) {
        b.re.lastIndex = 0
        const m = line.match(b.re)
        if (m) findings.push({ file: rel, line: i + 1, rule: `${m[0]} — ${b.why}`, text: line.trim().slice(0, 90) })
      }
    })
  }
}

if (findings.length === 0) {
  console.log('design:check — чисто. Значений и утилит мимо DESIGN.md не найдено.')
  process.exit(0)
}

console.error(`design:check — найдено ${findings.length}: расхождения с DESIGN.md\n`)
for (const f of findings) console.error(`  ${f.file}:${f.line}  [${f.rule}]  ${f.text}`)
console.error('\nПочинить: завести токен в DESIGN.md → npm run design:tokens → сослаться на него.')
process.exit(1)

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
    })
  }
}

if (findings.length === 0) {
  console.log('design:check — чисто. Цветов и шрифтов мимо токенов не найдено.')
  process.exit(0)
}

console.error(`design:check — найдено ${findings.length}: значения заведены мимо DESIGN.md\n`)
for (const f of findings) console.error(`  ${f.file}:${f.line}  [${f.rule}]  ${f.text}`)
console.error('\nПочинить: завести токен в DESIGN.md → npm run design:tokens → сослаться на него.')
process.exit(1)

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

  // --- Дыры, найденные ревизией 17.09 ---------------------------------------
  // Проверка ловила литералы и запрещённые утилиты, но пропускала три класса
  // нарушений, которыми система и разъехалась: числовые утилиты Tailwind мимо
  // нашей шкалы, произвольные значения в скобках и дефолтную палитру.

  // Числовые утилиты размеров и отступов: p-4, gap-3, w-40, size-5, h-12.
  // Tailwind v4 их не удаляет, и они работают мимо токенов — именно так
  // появились четыре разные ширины полей ввода.
  // Ноль исключён намеренно: `min-w-0` и `mt-0` — не размер из шкалы,
  // а его снятие, и заменять их токеном нечем.
  { re: /\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y|w|h|size|min-w|min-h|max-w|max-h)-(?!0\b)\d+(?:\.\d+)?\b/g,
    why: 'размер мимо шкалы: отступы и размеры — только токенами (p-md, gap-lg, size-target) — DESIGN.md § Layout' },

  // Дефолтная палитра Tailwind. Литералов в ней нет, а цвет мимо системы есть.
  { re: /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|accent|caret|decoration|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    why: 'палитра Tailwind мимо системы: пять смыслов — пять цветов — DESIGN.md § Colors' },
  { re: /\b(?:bg|text|border)-(?:white|black)\b/g,
    why: 'чистый белый и чёрный в системе не используются: холст мягкий, текст графитовый — DESIGN.md § Colors' },

  // Инлайновые стили: мимо всех проверок разом.
  { re: /style=\{\{/g,
    why: 'инлайновый стиль обходит систему целиком — заведите токен или класс' },
]

/**
 * Произвольные значения в квадратных скобках разрешены только из этого
 * списка. Без белого списка любое число в скобках законно — так и появились
 * три разные меры текста (62ch, 58ch, 54ch), каждая выбранная на глаз.
 */
const ALLOWED_ARBITRARY = new Set([
  '10rem', // короткое поле: число, код, цена (§ Layout, ширины полей)
  '20rem', // среднее поле: город, дата, район
  '1440px', // ширина страницы-рамы; колонка содержимого — токен column
  '3/2', '4/3', '3/4', '16/9', // соотношения сторон снимков
  '32rem', // минимальная ширина таблицы сравнения до горизонтальной прокрутки
  '1.5lh', // резерв места под строку сообщения: мера — высота строки, а не шкала
])

const ARBITRARY = /\[([^\]]+)\]/g

/**
 * Откуда брать текст классов. Правила утилит применяются НЕ ко всей строке
 * файла, а только к тем кускам, где классы и живут: атрибут className и —
 * для ui.ts, где компоненты системы собраны строками, — строковые литералы
 * с классами. Без этого проверка ловила квадратные скобки TypeScript:
 * `calls[0]`, `as [string, RequestInit]` и прочий обычный код.
 */
const CLASS_ATTR = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\}|\{"([^"]*)"\})/g
const CLASS_LINE = /['"`]([^'"`]*\b(?:bg|text|border|flex|grid|rounded|p|px|py|m|mt|mb|mx|my|gap|w|h|size|min-h|min-w|max-w|inline-flex|underline|tracking|font)-[a-z0-9[\]/.-]+[^'"`]*)['"`]/g

/** Классы, встреченные в строке кода. Пусто — значит проверять нечего. */
function classSnippets(line, isClassFile) {
  const out = []
  CLASS_ATTR.lastIndex = 0
  let m
  while ((m = CLASS_ATTR.exec(line)) !== null) out.push(m[1] ?? m[2] ?? m[3] ?? m[4] ?? '')
  if (isClassFile) {
    CLASS_LINE.lastIndex = 0
    while ((m = CLASS_LINE.exec(line)) !== null) out.push(m[1])
  }
  return out
}

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
    // ui.ts собирает компоненты системы строками классов — в нём проверяются
    // и обычные строковые литералы, а не только className.
    const isClassFile = rel.endsWith('components/ui.ts')
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
      // style={{ ... }} ищется по всей строке: это не класс.
      for (const b of BANNED) {
        if (!/style=/.test(String(b.re)) ) continue
        b.re.lastIndex = 0
        const m = line.match(b.re)
        if (m) findings.push({ file: rel, line: i + 1, rule: `${m[0]} — ${b.why}`, text: line.trim().slice(0, 90) })
      }

      // Остальные правила утилит — только по тексту классов.
      for (const snippet of classSnippets(line, isClassFile)) {
        for (const b of BANNED) {
          if (/style=/.test(String(b.re))) continue
          b.re.lastIndex = 0
          const m = snippet.match(b.re)
          if (m) findings.push({ file: rel, line: i + 1, rule: `${m[0]} — ${b.why}`, text: snippet.trim().slice(0, 90) })
        }

        // Произвольные значения — только из белого списка.
        ARBITRARY.lastIndex = 0
        let arb
        while ((arb = ARBITRARY.exec(snippet)) !== null) {
          const value = arb[1]
          // Динамическое значение из переменной проверить нечем.
          if (/[${}]/.test(value)) continue
          // transition-[...] перечисляет свойства перехода, а не размеры.
          if (/^[a-z-]+(?:,[a-z-]+)*$/.test(value)) continue
          if (ALLOWED_ARBITRARY.has(value)) continue
          findings.push({
            file: rel,
            line: i + 1,
            rule: `[${value}] — произвольное значение мимо системы: заведите токен в DESIGN.md — § Layout`,
            text: snippet.trim().slice(0, 90),
          })
        }
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

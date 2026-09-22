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
  // Односторонние скругления разрешены по именам ступеней, а не вообще:
  // t-lg — фото-крышка плитки, t-sm/b-sm/t-none/b-none — группа соседних
  // выбранных строк, скруглённая по краям и прямая внутри (§ Components).
  // Ступень при этом та же, что у целой формы; новых радиусов не заводится.
  { re: /\brounded-(?!none\b|sm\b|md\b|lg\b|full\b|t-lg\b|t-sm\b|b-sm\b|t-none\b|b-none\b)[a-z0-9[\]]+/g,
    why: 'ступени радиуса: 0 фото документа и линии, 10 кнопки и поля, 16 плашки и снимок витрины, 20 блок-призыв, full точка и чипс — DESIGN.md § Shapes' },
  { re: /\brounded(?![-a-z0-9])/g,
    why: 'голый rounded — это дефолт Tailwind мимо шкалы — DESIGN.md § Shapes' },
  // 700 разрешён с 22.09: на нём стоят display и heading, набранные Bitter
  // (§ Typography). Крайние веса — 800 и выше, 300 и ниже — по-прежнему нет.
  { re: /\bfont-(extrabold|black|light|extralight|thin)\b/g,
    why: 'шкала весов 400 / 500 / 600 / 700, крайних нет — DESIGN.md § Typography' },
  // Теней в системе нет вовсе (§ Elevation, правка 22.09): плитка витрины
  // перестала быть карточкой-подложкой, и `shadow-tile` снят вместе с ней.
  { re: /\b(drop-)?shadow-[a-z0-9[\]]+/g,
    why: 'теней в системе нет ни одной — DESIGN.md § Elevation' },
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

  // --- Дыры, найденные сверкой с детекторами Impeccable 17.09 ---------------
  // github.com/pbakaus/impeccable, реестр crates/foundation/src/registry.rs.
  // Взяты только те правила, которые уже следуют из DESIGN.md и проверяются
  // однозначно. Их вкусовые правила (запрет надстрочной метки, требование
  // разнобоя в отступах) не взяты — оба записаны в § Записанные противоречия.

  // Дефолтная типографская шкала Tailwind. Ролей шесть, и других размеров нет;
  // text-sm и text-2xl работают мимо ролей (их tiny-text, undersized-ui-text,
  // design-system-font-size).
  { re: /\btext-(?:xs|sm|base|lg|[2-9]?xl)\b/g,
    why: 'размер текста — только ролью: text-display · heading · subheading · body · body-sm · label — DESIGN.md § Typography' },

  // Трекинг парен роли и задаётся вместе с ней. Свободный трекинг разносит
  // или слепляет буквы (их wide-tracking, extreme-negative-tracking).
  // hero снят из списка вместе со ступенью (ревью 20.09): пока он тут стоял,
  // чекер молча разрешал tracking-hero, которого в токенах уже нет.
  { re: /\btracking-(?!display\b|heading\b|subheading\b|body-sm\b|body\b|label\b)[a-z0-9[\]-]+/g,
    why: 'трекинг — только парным к роли токеном (tracking-body, tracking-label) — DESIGN.md § Typography' },

  // Выключка по формату: без переносов даёт «реки» (их justified-text).
  { re: /\btext-justify\b/g,
    why: 'выключки по формату нет, выравнивание левое — DESIGN.md § Typography' },

  // Четвёртая мера ТЕКСТА. Ширин текста три, и все три названы; max-w-prose
  // или max-w-screen-lg заводит четвёртую незаметно (их line-length).
  //
  // `shelf` сюда не относится и добавлен 20.09: это не мера строки, а рама
  // страницы и ширина витрины (§ Layout). Раньше то же число стояло
  // литералом max-w-[1440px] и правило обходило его через ветку с «[».
  { re: /\bmax-w-(?!measure-title\b|measure\b|column\b|shelf\b|full\b|\[)[a-z0-9-]+/g,
    why: 'ширин текста три: measure, measure-title, полная ширина блока — DESIGN.md § Мера строки' },

  // Движение без события: пульсация, мигание, бегущая строка, отскок
  // (их pulsing-dot, blinking-cursor, marquee, bounce-easing).
  // `animate-spin` разрешён с 22.09 и только кольцу прогресса: это движение
  // состояния «загружается», оно идёт ровно столько, сколько длится загрузка,
  // и крутит transform — раскладка не пересчитывается (§ Состояния, § Layout).
  // Всё остальное движение по-прежнему запрещено: пульсация, отскок, бегущая
  // строка — имитация жизни там, где ничего не происходит.
  { re: /\banimate-(?!spin\b)[a-z0-9[\]-]+/g,
    why: 'движение принадлежит состояниям, а не украшению — DESIGN.md § Отклик' },
  { re: /\bhover:(?:scale|rotate|skew)-[a-z0-9[\]./-]+/g,
    why: 'снимок при наведении не растёт и не крутится — DESIGN.md § Отклик' },

  // Переход «всего сразу» тянет за собой ширину, высоту и отступы, то есть
  // пересчёт раскладки каждый кадр (их layout-transition).
  { re: /\btransition-all\b/g,
    why: 'двигаются только цвет, прозрачность и transform — перечислите свойства — DESIGN.md § Отклик' },
  { re: /\btransition-\[[^\]]*\b(?:width|height|padding|margin|top|left|right|bottom)\b[^\]]*\]/g,
    why: 'анимация раскладки: ширина, высота и отступы каждый кадр пересчитывают страницу — DESIGN.md § Отклик' },

  // Снятый фокус. Контур 2px — единственное, по чему человек с клавиатурой
  // понимает, где он находится; «не убирать никогда» (§ Состояния).
  // hidden тут не лишний: Tailwind v4 переименовал утилиту. Прежнее поведение
  // `outline-none` переехало в `outline-hidden`, а `outline-none` стало значить
  // outline-style: none. Снимают фокус оба, и документация v4 подскажет второе.
  { re: /\b(?:focus:|focus-visible:)?outline-(?:none|0|hidden)\b/g,
    why: 'фокус не снимается никогда: контур 2px primary со смещением 2 — DESIGN.md § Состояния' },
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
 * Правила, проверяемые по ВСЕЙ строке, а не по тексту классов, и подчинённые
 * пометке design-ok. Строки-комментарии сюда не доходят — они отсеяны выше,
 * поэтому стрелка «→» в пояснении к коду проверку не беспокоит.
 */
const LINE_BANNED = [
  // Эмодзи. В системе один набор иконок, рисованный вручную, в одном стиле
  // и одной толщине; эмодзи рисует шрифт операционной системы, и на телефоне
  // заказчицы он другой, чем на десктопе мебельщика. Extended_Pictographic
  // покрывает пиктограммы и знаки вроде ⚠, но НЕ стрелки и типографику.
  { re: /\p{Extended_Pictographic}/gu,
    why: 'эмодзи в интерфейсе не используются: один набор иконок, рисованный вручную — DESIGN.md § Иконки' },
]

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
  // Тени и градиенты литералами в CSS: классы забанены выше, но правило
  // в .css мимо них проходило. Их dark-glow, radial-halo, codex-grid-background,
  // repeating-stripes-gradient, gpt-thin-border-wide-shadow.
  { name: 'тень литералом (теней нет — § Elevation)',
    re: /(?:box|text)-shadow\s*:(?!\s*none\b)/g },
  { name: 'градиент (градиентов нет — § Elevation)',
    re: /\b(?:repeating-)?(?:linear|radial|conic)-gradient\(/g },
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

/**
 * Уровни поверхности, § Elevation & Depth. Холст — ноль, плашка — первый,
 * вложенная плашка — второй. Третьего не бывает: он означает, что блок
 * спроектирован неверно и его надо разбить, а не подобрать ещё оттенок.
 *
 * Правило структурное, регуляркой по строке его не увидеть: нарушение —
 * не в том, ЧТО написано, а в том, что одно лежит внутри другого. Поэтому
 * здесь разбираются теги JSX и ведётся стек открытых элементов.
 *
 * Чего проверка не видит: поверхность, приехавшую из другого файла внутри
 * компонента. `<Panel><Card/></Panel>` в двух файлах статически не собрать.
 * Это и записано строкой 7 чек-листа экрана — там её проходят глазами.
 */
const SURFACE = /\bbg-surface-container(?:-high)?\b|\b(?:panel|stepPanel|panelNested)\b/

/** Теги HTML, которые считаются элементами. Всё с заглавной буквы — компонент. */
const HTML_TAGS = new Set([
  'a','article','aside','button','div','fieldset','footer','form','h1','h2','h3',
  'h4','h5','h6','header','label','li','main','nav','ol','p','section','span',
  'table','tbody','td','th','thead','tr','ul',
])

/**
 * Комментарии, забитые пробелами. Длина и переводы строк сохраняются, поэтому
 * номера строк и позиции остаются прежними.
 *
 * Нужно потому, что разбор тегов иначе принимает за разметку прозу: строка
 * «а не <a>» в пояснении к компоненту клала в стек тег, который никто
 * не закрывал. Маскировка идёт с оглядкой на строковые литералы — иначе
 * `href="https://…"` выглядел бы как начало комментария и съедал остаток тега.
 */
function maskComments(src) {
  const out = src.split('')
  let i = 0
  let quote = null
  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]
    if (quote) {
      if (c === '\\') { i += 2; continue }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') { out[i] = ' '; i++ }
      continue
    }
    if (c === '/' && next === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' '
        i++
      }
      out[i] = ' '; out[i + 1] = ' '; i += 2
      continue
    }
    i++
  }
  return out.join('')
}

/**
 * Теги файла в порядке появления. Конец тега ищется с учётом строк и фигурных
 * скобок: `onClick={() => x > 1}` содержит `>`, и наивный indexOf('>') оборвал
 * бы тег в середине.
 */
function scanTags(source) {
  const src = maskComments(source)
  const tags = []
  let i = 0
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt === -1) break
    const m = /^(\/?)([A-Za-z][A-Za-z0-9._]*)([\s/>])/.exec(src.slice(lt + 1))
    // Не тег: оператор сравнения, фрагмент `<>` и — по символу перед скобкой —
    // дженерик. В разметке перед `<` стоит пробел, перевод строки, `(` или `{`;
    // в `useState<Stage>` перед ней стоит буква. Без этой проверки `<Stage>`
    // ложится в стек как открытый элемент, который никто не закроет, и глубина
    // поверхностей дальше по файлу считается заниженной.
    // Проверка предшествующего символа касается ТОЛЬКО открывающих тегов:
    // перед закрывающим почти всегда стоит текст — `…US-20</main>` — и общий
    // фильтр выбрасывал бы его, завышая глубину.
    const before = lt > 0 ? src[lt - 1] : ' '
    const looksGeneric = m && m[1] === '' && /[A-Za-z0-9_$\])]/.test(before)
    if (!m || (!HTML_TAGS.has(m[2]) && !/^[A-Z]/.test(m[2])) || looksGeneric) {
      i = lt + 1
      continue
    }
    let j = lt + 1 + m[1].length + m[2].length
    let braces = 0
    let quote = null
    while (j < src.length) {
      const c = src[j]
      if (quote) { if (c === quote) quote = null; j++; continue }
      if (c === '"' || c === "'" || c === '`') { quote = c; j++; continue }
      if (c === '{') { braces++; j++; continue }
      if (c === '}') { braces--; j++; continue }
      if (c === '>' && braces === 0) break
      j++
    }
    if (j >= src.length) break
    tags.push({
      closing: m[1] === '/',
      selfClosing: src[j - 1] === '/',
      surface: SURFACE.test(src.slice(lt, j + 1)),
      line: src.slice(0, lt).split('\n').length,
    })
    i = j + 1
  }
  return tags
}

/** Находки по вложенности поверхностей в одном файле. */
function surfaceFindings(src, rel) {
  const out = []
  const stack = []
  for (const t of scanTags(src)) {
    if (t.closing) { stack.pop(); continue }
    if (t.selfClosing) {
      if (t.surface && stack.filter(Boolean).length >= 2) out.push(t.line)
      continue
    }
    if (t.surface && stack.filter(Boolean).length >= 2) out.push(t.line)
    stack.push(t.surface)
  }
  return out.map((line) => ({
    file: rel,
    line,
    rule: 'третий уровень поверхности: плашка в плашке в плашке — блок надо разбить, а не углублять — DESIGN.md § Elevation & Depth',
    text: '',
  }))
}

const findings = []
for (const base of SCAN) {
  for (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file)
    if (ALLOW.has(rel)) continue
    // ui.ts собирает компоненты системы строками классов — в нём проверяются
    // и обычные строковые литералы, а не только className.
    const isClassFile = rel.endsWith('components/ui.ts')
    const source = readFileSync(file, 'utf8')
    if (/\.[jt]sx$/.test(rel)) findings.push(...surfaceFindings(source, rel))
    const lines = source.split('\n')
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return
      for (const r of RULES) {
        r.re.lastIndex = 0
        if (r.re.test(line)) findings.push({ file: rel, line: i + 1, rule: r.name, text: line.trim().slice(0, 90) })
      }
      // Явное исключение: пометка design-ok на этой строке или на предыдущей.
      // Пометка обязана называть причину — молчаливых исключений не бывает.
      if (/design-ok:/.test(line) || (i > 0 && /design-ok:/.test(lines[i - 1]))) return
      for (const b of LINE_BANNED) {
        b.re.lastIndex = 0
        const m = line.match(b.re)
        if (m) findings.push({ file: rel, line: i + 1, rule: `${m[0]} — ${b.why}`, text: line.trim().slice(0, 90) })
      }

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
          // Значение, собранное из токенов, литералом не является: раскладка
          // витрины — это repeat(auto-fill, minmax(var(--spacing-tile-min), 1fr)),
          // и все размеры в нём приходят из DESIGN.md. Правило сторожит числа
          // мимо системы, а здесь чисел мимо системы нет (правка 20.09).
          // `1fr` и `auto` — доли и ключевые слова сетки, не размеры.
          if (/var\(--/.test(value) && !/\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)/.test(value)) continue
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

// Числа и склонения, общие для обеих зон. До этого жили двумя копиями —
// в текстах заказчицы и в текстах мебельщика: одно и то же склонение дней
// и один и тот же формат тенге. Копии расходятся молча, а разошедшись,
// показывают одному «35 дней», другому «35 день» на тех же данных.
//
// Склонение метров живёт отдельно, в questions/categories.ts: там оно часть
// формулировки вопроса, а не общего форматирования.
import type { LeadTime, WeekDay, WorkHours } from '../contract'

/** Разряды пробелом: «1 400 000» читается числом, «1400000» — строкой цифр. */
export function kzt(value: number): string {
  // toLocaleString ставит неразрывный пробел; заменяем на обычный, иначе
  // он копируется в буфер и ломает поиск по номеру и вставку в калькулятор.
  return value.toLocaleString('ru-RU').replace(/ /g, ' ')
}

/** 1 день · 2–4 дня · 5–20 дней · 21 день. Падежи согласованы (§ Presence). */
export function dayWord(count: number): string {
  const tens = Math.abs(count) % 100
  if (tens >= 11 && tens <= 14) return 'дней'
  const ones = Math.abs(count) % 10
  if (ones === 1) return 'день'
  if (ones >= 2 && ones <= 4) return 'дня'
  return 'дней'
}

/** «35 дней» одной строкой — самая частая связка. */
export function days(count: number): string {
  return `${count} ${dayWord(count)}`
}

/** Вилка цены: одинаковые границы — твёрдая цена, и врать про диапазон незачем. */
export function priceRange(minKzt: number, maxKzt: number): string {
  return minKzt === maxKzt ? `${kzt(minKzt)} ₸` : `${kzt(minKzt)} – ${kzt(maxKzt)} ₸`
}

/** Дни недели коротко. Порядок именно такой — неделя начинается с понедельника. */
const WEEK: readonly { id: WeekDay; short: string }[] = [
  { id: 'mon', short: 'Пн' },
  { id: 'tue', short: 'Вт' },
  { id: 'wed', short: 'Ср' },
  { id: 'thu', short: 'Чт' },
  { id: 'fri', short: 'Пт' },
  { id: 'sat', short: 'Сб' },
  { id: 'sun', short: 'Вс' },
]

/**
 * «Пн–Сб» вместо «Пн, Вт, Ср, Чт, Пт, Сб». Подряд идущие дни сворачиваются
 * в отрезок, разрывы остаются разрывами: «Пн–Пт, Вс» — это не то же самое,
 * что «Пн–Вс», и человек, приехавший в субботу, разницу почувствует.
 */
export function weekDays(days: readonly WeekDay[]): string {
  if (days.length === 0) return ''

  const spans: { from: string; to: string }[] = []
  let index = 0
  for (const day of WEEK) {
    if (!days.includes(day.id)) continue
    const previous = spans.at(-1)
    const position = WEEK.findIndex((item) => item.id === day.id)
    if (previous !== undefined && position === index + 1) previous.to = day.short
    else spans.push({ from: day.short, to: day.short })
    index = position
  }

  return spans
    .map((span) => (span.from === span.to ? span.from : `${span.from}–${span.to}`))
    .join(', ')
}

/** «Пн–Сб, 10:00–19:00». Одной строкой: две — это уже расписание, а не подпись. */
export function workHours(hours: WorkHours): string {
  return `${weekDays(hours.days)}, ${hours.from}–${hours.to}`
}

/** «от 25 до 35 дней» · «25 дней», когда границы совпали. */
export function leadTime(time: LeadTime): string {
  return time.min === time.max ? days(time.max) : `от ${time.min} до ${days(time.max)}`
}

/** 1 месяц · 2–4 месяца · 5–12 месяцев. Год и два года — словами, так говорят. */
export function warranty(months: number): string {
  if (months === 12) return 'год'
  if (months === 24) return 'два года'
  const tens = Math.abs(months) % 100
  const ones = Math.abs(months) % 10
  if (tens >= 11 && tens <= 14) return `${months} месяцев`
  if (ones === 1) return `${months} месяц`
  if (ones >= 2 && ones <= 4) return `${months} месяца`
  return `${months} месяцев`
}

/**
 * Счётчик символов у поля с пределом (DESIGN.md § Content, 22.09):
 * ограничение, о котором человек узнаёт только из сообщения об ошибке, —
 * дефект, он уже написал текст. Формат один на весь продукт: заявка,
 * профиль мастерской, свободные строки предложения.
 */
export function charCounter(used: number, max: number): string {
  return `${used} / ${max}`
}

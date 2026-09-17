// Числа и склонения, общие для обеих зон. До этого жили двумя копиями —
// в текстах заказчицы и в текстах мебельщика: одно и то же склонение дней
// и один и тот же формат тенге. Копии расходятся молча, а разошедшись,
// показывают одному «35 дней», другому «35 день» на тех же данных.
//
// Склонение метров живёт отдельно, в questions/categories.ts: там оно часть
// формулировки вопроса, а не общего форматирования.

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

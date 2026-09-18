// Склонения и числа — ядро в том смысле, что их видит каждый человек
// на обеих сторонах. Копий больше нет, значит и проверка одна.
import { describe, expect, it } from 'vitest'
import { days, dayWord, kzt, leadTime, priceRange, warranty, weekDays, workHours } from './format'

describe('dayWord', () => {
  it('единственное: 1, 21, 31', () => {
    for (const n of [1, 21, 31, 101]) expect(dayWord(n)).toBe('день')
  })

  it('от двух до четырёх', () => {
    for (const n of [2, 3, 4, 22, 33]) expect(dayWord(n)).toBe('дня')
  })

  it('пять и дальше', () => {
    for (const n of [5, 9, 20, 25, 100]) expect(dayWord(n)).toBe('дней')
  })

  it('подростки — исключение: 11–14 всегда «дней»', () => {
    for (const n of [11, 12, 13, 14, 111, 112]) expect(dayWord(n)).toBe('дней')
  })

  it('строка целиком', () => {
    expect(days(1)).toBe('1 день')
    expect(days(35)).toBe('35 дней')
  })
})

describe('kzt', () => {
  it('разряды делятся обычным пробелом, а не неразрывным', () => {
    const value = kzt(1_400_000)
    expect(value).toBe('1 400 000')
    expect(value).not.toContain(' ')
  })

  it('маленькие числа не трогаются', () => {
    expect(kzt(900)).toBe('900')
  })
})

describe('priceRange', () => {
  it('вилка', () => {
    expect(priceRange(900_000, 1_400_000)).toBe('900 000 – 1 400 000 ₸')
  })

  it('одинаковые границы — твёрдая цена, диапазон не выдумывается', () => {
    expect(priceRange(1_000_000, 1_000_000)).toBe('1 000 000 ₸')
  })
})

describe('часы работы мастерской', () => {
  it('подряд идущие дни сворачивает в отрезок', () => {
    expect(weekDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])).toBe('Пн–Сб')
  })

  it('разрыв в неделе остаётся разрывом', () => {
    // «Пн–Пт, Вс» и «Пн–Вс» — разные обещания для того, кто приехал в субботу.
    expect(weekDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sun'])).toBe('Пн–Пт, Вс')
  })

  it('один день не превращается в отрезок', () => {
    expect(weekDays(['sat'])).toBe('Сб')
  })

  it('порядок дней не зависит от порядка в данных', () => {
    expect(weekDays(['sat', 'mon', 'tue'])).toBe('Пн–Вт, Сб')
  })

  it('часы показывает вместе с днями', () => {
    expect(workHours({ days: ['mon', 'tue'], from: '10:00', to: '19:00' })).toBe('Пн–Вт, 10:00–19:00')
  })
})

describe('срок и гарантия', () => {
  it('вилку срока показывает от и до', () => {
    expect(leadTime({ min: 25, max: 35 })).toBe('от 25 до 35 дней')
  })

  it('совпавшие границы — один срок, без вилки', () => {
    expect(leadTime({ min: 30, max: 30 })).toBe('30 дней')
  })

  it('год и два года называет словами', () => {
    expect(warranty(12)).toBe('год')
    expect(warranty(24)).toBe('два года')
  })

  it('прочие сроки склоняет', () => {
    expect(warranty(1)).toBe('1 месяц')
    expect(warranty(3)).toBe('3 месяца')
    expect(warranty(18)).toBe('18 месяцев')
  })
})

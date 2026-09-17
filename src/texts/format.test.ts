// Склонения и числа — ядро в том смысле, что их видит каждый человек
// на обеих сторонах. Копий больше нет, значит и проверка одна.
import { describe, expect, it } from 'vitest'
import { days, dayWord, kzt, priceRange } from './format'

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

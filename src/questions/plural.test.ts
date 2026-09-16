// Склонение единицы измерения. Отдельным файлом от контрактных тестов:
// здесь проверяется формулировка, а не схема. environment: 'node' —
// DOM в срезе не тестируется (vitest.config.ts).
import { describe, expect, it } from 'vitest'
import { metersUnit } from './categories'

describe('metersUnit — целые числа', () => {
  it('1 — «метр»', () => {
    expect(metersUnit(1)).toBe('метр')
    expect(metersUnit('1')).toBe('метр')
  })

  it('2, 4 — «метра»', () => {
    expect(metersUnit(2)).toBe('метра')
    expect(metersUnit(4)).toBe('метра')
  })

  it('5 — «метров»', () => {
    expect(metersUnit(5)).toBe('метров')
  })

  // Второй десяток — исключение целиком: 11 и 12 идут «метров»,
  // хотя по последней цифре просились бы «метр» и «метра».
  it('11, 12 — «метров»', () => {
    expect(metersUnit(11)).toBe('метров')
    expect(metersUnit(12)).toBe('метров')
  })

  it('21 — «метр», 22 — «метра», 25 — «метров»', () => {
    expect(metersUnit(21)).toBe('метр')
    expect(metersUnit(22)).toBe('метра')
    expect(metersUnit(25)).toBe('метров')
  })

  it('100 — «метров», 101 — «метр»', () => {
    expect(metersUnit(100)).toBe('метров')
    expect(metersUnit(101)).toBe('метр')
  })
})

describe('metersUnit — дробные', () => {
  // В поле вводят через запятую; дробная запись всегда берёт «метра»,
  // включая 10,0 — по записи, а не по значению.
  it('0,5 · 3,2 · 10,0 — «метра»', () => {
    expect(metersUnit('0,5')).toBe('метра')
    expect(metersUnit('3,2')).toBe('метра')
    expect(metersUnit('10,0')).toBe('метра')
  })

  it('точка вместо запятой читается так же', () => {
    expect(metersUnit('3.2')).toBe('метра')
    expect(metersUnit(3.2)).toBe('метра')
  })
})

describe('metersUnit — пустое и мусор', () => {
  it('пустое поле — нейтральное «метров»', () => {
    expect(metersUnit('')).toBe('метров')
    expect(metersUnit('   ')).toBe('метров')
  })

  it('нечисловое — «метров», подпись не ломается на вводе', () => {
    expect(metersUnit('три')).toBe('метров')
  })
})

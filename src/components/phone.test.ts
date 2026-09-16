// Разбор номера телефона. Поле управляемое: значение ходит по кругу
// «значение → показ → разбор → значение», и круг обязан быть тождественным.
// Когда он таким не был, испорченный номер проходил схему Phone и уходил
// на сервер молча — код подтверждения улетал чужому человеку.
import { describe, expect, it } from 'vitest'
import { Phone } from '../contract'
import { format, nextValue, PHONE_DIGITS } from './phone'

const NUMBER = '7012345678'

/** Набор с клавиатуры: каретка в конце, React перерисовывает поле после каждой цифры. */
function typeInto(start: string, keys: string): string {
  let value = start
  for (const key of keys) value = nextValue(value, format(value) + key)
  return value
}

/** Backspace: браузер стирает последний символ показанного значения. */
function backspace(value: string): string {
  return nextValue(value, format(value).slice(0, -1))
}

describe('показ и разбор обратимы', () => {
  it('разбор показанного значения даёт то же значение, на любой длине', () => {
    for (let length = 0; length <= PHONE_DIGITS; length++) {
      const digits = NUMBER.slice(0, length)
      expect(nextValue(digits, format(digits))).toBe(digits)
    }
  })
})

describe('набор с клавиатуры', () => {
  it('десять цифр в пустое поле дают ровно эти цифры', () => {
    expect(typeInto('', NUMBER)).toBe(NUMBER)
  })

  it('на каждом шаге в значении лежит ровно набранное, без примеси префикса', () => {
    let value = ''
    for (let i = 0; i < NUMBER.length; i++) {
      value = nextValue(value, format(value) + NUMBER[i])
      expect(value).toBe(NUMBER.slice(0, i + 1))
    }
  })

  it('ведущая восьмёрка отбрасывается', () => {
    expect(typeInto('', '8' + NUMBER)).toBe(NUMBER)
  })

  it('одиннадцатая цифра в заполненное поле не меняет номер', () => {
    expect(typeInto(NUMBER, '5')).toBe(NUMBER)
  })
})

describe('правка уже заполненного поля', () => {
  it('стереть две цифры и набрать другие — меняется только хвост', () => {
    const shortened = backspace(backspace(NUMBER))
    expect(shortened).toBe('70123456')
    expect(typeInto(shortened, '99')).toBe('7012345699')
  })

  it('backspace укорачивает номер на одну цифру', () => {
    expect(backspace(NUMBER)).toBe('701234567')
  })

  it('backspace по разделителю не залипает', () => {
    // '+7 (701)' — последний символ скобка, цифр она не несёт
    expect(backspace('701')).toBe('70')
  })
})

describe('вставка из буфера в пустое поле', () => {
  const variants = ['+7 701 234 56 78', '+77012345678', '87012345678', '7012345678']
  for (const pasted of variants) {
    it(`«${pasted}» даёт ${NUMBER}`, () => {
      expect(nextValue('', pasted)).toBe(NUMBER)
    })
  }
})

describe('переполнение лечится с разных концов', () => {
  it('лишняя цифра в хвосте — при доборе в заполненное поле', () => {
    // '70123456785' пришло от опечатки: отрезать надо хвост
    expect(nextValue(NUMBER, `${format(NUMBER)}5`)).toBe(NUMBER)
  })

  it('лишняя цифра в начале — при вставке номера с кодом страны', () => {
    // те же одиннадцать цифр, но поле было пустым: отрезать надо начало
    expect(nextValue('', '77012345678')).toBe(NUMBER)
  })

  it('вставка поверх заполненного поля разбирается как вставка, не как добор', () => {
    expect(nextValue(NUMBER, '77012345678')).toBe(NUMBER)
  })

  it('одна восьмёрка не оседает в значении', () => {
    expect(nextValue('', '8')).toBe('')
  })
})

describe('правка уже набранного режется с хвоста', () => {
  it('цифра, вставленная в середину полного поля, не сдвигает номер', () => {
    // одиннадцать цифр: это правка, а не номер с кодом страны
    expect(nextValue(NUMBER, '+7 (701)9 234-56-78')).toBe('7019234567')
  })

  it('цифра, вставленная в начало полного поля', () => {
    expect(nextValue(NUMBER, '+7 (9701) 234-56-78')).toBe('9701234567')
  })

  it('длинная вставка в пустое поле обрезается, а не сдвигается', () => {
    expect(nextValue('', '70123456789012')).toBe(NUMBER)
  })

  it('вставка поверх выделенного без нашего префикса — свежий ввод', () => {
    expect(nextValue(NUMBER, '77012345678')).toBe(NUMBER)
    expect(nextValue(NUMBER, '87012345678')).toBe(NUMBER)
  })

  it('мусор без цифр опустошает поле, а не роняет разбор', () => {
    expect(nextValue(NUMBER, '')).toBe('')
    expect(nextValue(NUMBER, 'абвгд')).toBe('')
  })
})

describe('стык с контрактом', () => {
  it('набранный номер принимается схемой Phone', () => {
    expect(Phone.safeParse(`+7${typeInto('', NUMBER)}`).success).toBe(true)
  })

  it('испорченный правкой номер не должен получаться вовсе', () => {
    const edited = typeInto(backspace(NUMBER), '9')
    expect(edited).toBe('7012345679')
    expect(Phone.safeParse(`+7${edited}`).success).toBe(true)
  })
})

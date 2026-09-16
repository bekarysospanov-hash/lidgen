// Поле телефона. Наружу отдаёт только десять национальных цифр — собрать
// из них +7XXXXXXXXXX (формат контракта, Phone) может вызывающий экран.
// Разбор и показ живут в phone.ts и покрыты phone.test.ts: поле управляемое,
// значение ходит по кругу «показ → разбор → значение», и круг обязан быть
// тождественным. Один раз он таким не был — номер портился молча.
import { format, nextValue, PHONE_MASK } from './phone'
import { field } from './ui'

export interface PhoneInputProps {
  id?: string
  /** Десять национальных цифр, без кода страны. */
  value: string
  onChange: (digits: string) => void
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
}

export function PhoneInput({
  id,
  value,
  onChange,
  invalid = false,
  describedBy,
  disabled = false,
}: PhoneInputProps) {
  return (
    <input
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={format(value)}
      placeholder={PHONE_MASK}
      disabled={disabled}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      onChange={(event) => onChange(nextValue(value, event.target.value))}
      // Поле системы: рамка 1px, радиус 4, ошибка красит границу — и вместе
      // с ней красный текст под полем, его ставит вызывающий экран
      // (DESIGN.md § Components, § Состояния).
      className={`w-full max-w-[22ch] tabular-nums ${field(invalid)}`}
    />
  )
}

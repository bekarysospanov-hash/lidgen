// Поле телефона. Наружу отдаёт только десять национальных цифр — собрать
// из них +7XXXXXXXXXX (формат контракта, Phone) может вызывающий экран.
// Разбор и показ живут в phone.ts и покрыты phone.test.ts: поле управляемое,
// значение ходит по кругу «показ → разбор → значение», и круг обязан быть
// тождественным. Один раз он таким не был — номер портился молча.
import { format, nextValue, PHONE_MASK } from './phone'

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
      // Волосяная граница снизу, радиус ноль — как у поля размера
      // (DESIGN.md § Components). Ошибка красит границу, не текст.
      className={`w-full max-w-[22ch] border-0 border-b bg-surface px-xs py-sm text-body
        tracking-body tabular-nums transition-opacity duration-100
        placeholder:opacity-40 hover:opacity-70 active:opacity-70
        disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40
        ${invalid ? 'border-stroke-signal' : 'border-outline'}`}
    />
  )
}

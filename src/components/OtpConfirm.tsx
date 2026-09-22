// Шаг подтверждения номера. Живёт внутри страницы заявки, не отдельным
// роутом и не модальным окном: модальных окон в системе нет (DESIGN.md §
// Layout). Наружу отдаёт готовый RequestConfirmed — что с ним делать,
// решает экран. Ходит только через api.* (CLAUDE.md).
import { SavedIcon } from './icons'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { isApiError } from '../api/errors'
import type { OtpSent, RequestConfirmed } from '../contract'
import { probeText } from '../texts/probe'
import { errorText, otpDeadEnd, otpStep } from '../texts/request'
import { buttonFilled, buttonText, errorTextClass, field, fieldLabel, hintText, notice } from './ui'

/** Номер показываем, но не целиком: он уже подтверждается, а не вводится. */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length < 10) return phone
  return `+7 (${digits.slice(0, 3)}) ***-**-${digits.slice(8)}`
}

export interface OtpConfirmProps {
  requestId: string
  /** Телефон в формате контракта, +7XXXXXXXXXX. Показывается маскированным. */
  phone: string
  /** Ответ createRequest: канал, длина кода и кулдаун первого повтора. */
  otp: OtpSent
  onConfirmed: (result: RequestConfirmed) => void
  /**
   * Выход из тупика: подтверждать больше нечего (§8, ALREADY_CONFIRMED)
   * или заявки на сервере нет. Экран решает, что это значит, — шаг с кодом
   * только зовёт. Без него человеку с этого экрана некуда деться.
   */
  onRestart: () => void
}

/** Коды, после которых форма кода бессмысленна: вводить больше некуда. */
type DeadEndCode = keyof typeof otpDeadEnd
const DEAD_END_CODES: DeadEndCode[] = ['ALREADY_CONFIRMED', 'REQUEST_NOT_FOUND']

export function OtpConfirm({ requestId, phone, otp, onConfirmed, onRestart }: OtpConfirmProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deadEnd, setDeadEnd] = useState<DeadEndCode | null>(null)
  // Первый повтор всегда под кулдауном: сервер прислал retryAfterSec вместе
  // с заявкой (контракт §5, OtpSent) — отсчёт начинается с него, а не с нуля.
  const [cooldown, setCooldown] = useState(otp.retryAfterSec)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((left) => Math.max(0, left - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  function report(caught: unknown, fallback: string) {
    if (!isApiError(caught)) {
      setError(fallback)
      return
    }
    // Кулдаун приходит в деталях ошибки — отсчёт на кнопке идёт из него,
    // а не из собственного таймера фронта (контракт §6).
    const retryAfterSec = Number(caught.details?.retryAfterSec ?? 0)
    if (retryAfterSec > 0) setCooldown(retryAfterSec)
    // Тупик: форму кода дальше показывать нечестно — она ничего не изменит.
    if ((DEAD_END_CODES as string[]).includes(caught.code)) {
      setDeadEnd(caught.code as DeadEndCode)
      return
    }
    setError(
      caught.code === 'VALIDATION_FAILED' ? otpStep.errorFormat : errorText[caught.code],
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (code.trim().length === 0) {
      setError(otpStep.errorEmpty)
      return
    }
    setBusy(true)
    setError(null)
    setNote(null)
    // Результат забирается из try, а вызов onConfirmed — уже за ним: иначе
    // исключение из родительского navigate() прилетело бы сюда и было бы
    // показано как сбой API, хотя подтверждение прошло.
    let confirmed: RequestConfirmed
    try {
      confirmed = await api.confirmOtp({ requestId, code: code.trim() })
    } catch (caught) {
      report(caught, errorText.INTERNAL)
      return
    } finally {
      setBusy(false)
    }
    onConfirmed(confirmed)
  }

  async function resend() {
    if (busy || cooldown > 0) return
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const sent = await api.resendOtp({ requestId })
      setCooldown(sent.retryAfterSec)
      setNote(otpStep.resendDone)
    } catch (caught) {
      report(caught, errorText.NETWORK)
    } finally {
      setBusy(false)
    }
  }

  if (deadEnd) {
    const exit = otpDeadEnd[deadEnd]
    return (
      <section className="mt-3xl">
        <h2 className="text-subheading tracking-subheading font-medium">{exit.title}</h2>
        <p className="mt-sm max-w-measure text-body tracking-body">{exit.body}</p>
        {/* Единственное действие экрана в этом состоянии — значит залитая. */}
        <button type="button" onClick={onRestart}
          className={`mt-xl whitespace-nowrap ${buttonFilled}`}>
          {otpStep.restart}
        </button>
      </section>
    )
  }

  return (
    <section className="mt-3xl">
      <h2 className="text-subheading tracking-subheading font-medium">{otpStep.title}</h2>
      <p className={`mt-sm max-w-measure ${hintText}`}>
        {otpStep.lede} {maskPhone(phone)}
      </p>

      {/* Плашка-уведомление (§ Components, 22.09). Отвал на коде считается
          отдельно, и страх у него один — «сейчас всё потеряется». Заявка
          к этому моменту создана: сказать об этом дешевле, чем потерять
          человека на последнем шаге. */}
      <p className={`mt-lg max-w-measure ${notice}`}>
        <span aria-hidden className="shrink-0"><SavedIcon /></span>
        <span>{otpStep.savedNotice}</span>
      </p>

      <form onSubmit={submit} className="mt-lg">
        <label htmlFor="otp-code" className={`block ${fieldLabel}`}>
          {otpStep.codeLabel}
        </label>
        <input
          id="otp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={otp.codeLength}
          value={code}
          placeholder={otpStep.codePlaceholder}
          aria-invalid={Boolean(error)}
          aria-describedby="otp-message"
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, '').slice(0, otp.codeLength))
            setError(null)
          }}
          className={`mt-sm block w-[10rem] tabular-nums ${field(Boolean(error))}`}
        />

        {/* Ошибка красным и в тексте, и в границе поля — § Состояния требует
            обоих каналов; подсказка и ответ на повтор идут приглушённым. */}
        <div
          id="otp-message"
          role="status"
          className={`mt-md min-h-[1.5lh] max-w-measure ${error ? errorTextClass : hintText}`}
        >
          {error ?? note ?? probeText?.code}
        </div>

        <div className="mt-lg flex flex-col gap-md sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={busy}
            className={`whitespace-nowrap ${buttonFilled}`}
          >
            {busy ? otpStep.submitting : otpStep.submit}
          </button>

          {/* Вторая кнопка залитой быть не может: заливка — у главного
              действия экрана, одного (DESIGN.md § Components). Кнопка-текст
              системы: зелёная надпись без заливки. */}
          <button
            type="button"
            onClick={resend}
            disabled={busy || cooldown > 0}
            className={`self-start ${buttonText}`}
          >
            {cooldown > 0 ? otpStep.resendIn(cooldown) : otpStep.resend}
          </button>
        </div>
      </form>
    </section>
  )
}

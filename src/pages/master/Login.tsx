// US-17 — вход в кабинет мебельщика. Две стадии на одной странице: номер,
// потом код. Отдельным роутом для кода не делаем и модальным окном тоже —
// модальных окон в системе нет, шаг показывается стадией той же страницы
// (DESIGN.md § Layout).
//
// Пароля нет вовсе, и это решение, а не упрощение: Марат отвечает на заявки
// с телефона между цехом и замерами. Пароль он забудет или запишет на коробке.
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { MasterShell } from '../../components/MasterShell'
import { PhoneInput } from '../../components/PhoneInput'
import { format } from '../../components/phone'
import {
  buttonFilled,
  buttonText,
  errorTextClass,
  field,
  fieldLabel,
  hintText,
} from '../../components/ui'
import type { OtpSent } from '../../contract'
import { errorText } from '../../texts/request'
import { loginPage, probeHint, probeVisible } from '../../texts/master'
import { readSession, writeSession } from './session'

type Stage =
  | { kind: 'phone' }
  | { kind: 'code'; phone: string; otp: OtpSent }
  /** Номера нет в списке: форма кода бессмысленна, вводить нечего. */
  | { kind: 'unknownPhone' }

export default function MasterLogin() {
  const navigate = useNavigate()
  // Хранилище читается один раз при монтировании: разбирать его схемой
  // на каждый рендер незачем, а войти за время жизни этого экрана можно
  // только через него же.
  const [signedIn] = useState(() => readSession() !== null)
  const [stage, setStage] = useState<Stage>({ kind: 'phone' })
  const [digits, setDigits] = useState('')
  const [code, setCode] = useState('')
  /**
   * Ошибка знает, к чему относится. Без этого «отправить ещё раз можно
   * позже» красило рамку поля кода — человек видел «код неверный» там,
   * где кода ещё не вводил. Поле красится только ошибкой поля.
   */
  const [error, setError] = useState<{ scope: 'phone' | 'code' | 'form'; text: string } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((left) => Math.max(0, left - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // Вошедшему на этом экране делать нечего — он идёт к заявкам.
  if (signedIn) return <Navigate to="/master/requests" replace />

  const phone = `+7${digits}`

  function report(caught: unknown, scope: 'phone' | 'code' | 'form') {
    if (!isApiError(caught)) return setError({ scope: 'form', text: errorText.INTERNAL })
    if (caught.code === 'MASTER_NOT_FOUND') {
      setError(null)
      return setStage({ kind: 'unknownPhone' })
    }
    // Кулдаун приходит в деталях ошибки: отсчёт на кнопке идёт из ответа
    // сервера, а не из собственного таймера фронта (контракт §6).
    if (caught.code === 'OTP_RESEND_TOO_SOON') {
      const left = Number((caught.details as { retryAfterSec?: number } | undefined)?.retryAfterSec)
      if (Number.isFinite(left)) setCooldown(left)
      // Кулдаун — ответ на нажатие кнопки, а не на содержимое поля.
      return setError({ scope: 'form', text: errorText[caught.code] })
    }
    setError({ scope, text: errorText[caught.code] })
  }

  function requestCode() {
    if (digits.length !== 10) return setError({ scope: 'phone', text: loginPage.errorPhone })
    setError(null)
    setBusy(true)
    api.masterRequestCode({ phone }).then(
      (otp) => {
        setBusy(false)
        setCooldown(otp.retryAfterSec)
        setStage({ kind: 'code', phone, otp })
      },
      (caught: unknown) => {
        setBusy(false)
        report(caught, 'phone')
      },
    )
  }

  function resend() {
    setError(null)
    setBusy(true)
    api.masterRequestCode({ phone }).then(
      (otp) => {
        setBusy(false)
        setCooldown(otp.retryAfterSec)
      },
      (caught: unknown) => {
        setBusy(false)
        report(caught, 'form')
      },
    )
  }

  function submit() {
    if (code.length !== 4) return setError({ scope: 'code', text: loginPage.errorCode })
    setError(null)
    setBusy(true)
    api.masterConfirmCode({ phone, code }).then(
      (session) => {
        setBusy(false)
        writeSession(session)
        navigate('/master/requests', { replace: true })
      },
      (caught: unknown) => {
        setBusy(false)
        report(caught, 'code')
      },
    )
  }

  if (stage.kind === 'unknownPhone') {
    return (
      <MasterShell>
        <h1 className="text-heading tracking-heading font-semibold">{loginPage.notFoundTitle}</h1>
        <p className="mt-lg max-w-[58ch] text-body tracking-body">{loginPage.notFoundBody}</p>
        {/* Тупик обязан говорить, что подходит: без этого на пробе человек
            упирается в «нет в списке» и не знает, каким номером войти. */}
        {probeVisible && (
          <p className={`mt-lg max-w-[58ch] ${hintText}`}>
            {probeHint.phones} {probeHint.phonesMore}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setDigits('')
            setStage({ kind: 'phone' })
          }}
          className={`mt-xl ${buttonFilled}`}
        >
          {loginPage.notFoundBack}
        </button>
      </MasterShell>
    )
  }

  if (stage.kind === 'code') {
    return (
      <MasterShell>
        <h1 className="text-heading tracking-heading font-semibold">{loginPage.codeTitle}</h1>
        <p className={`mt-sm ${hintText}`}>{loginPage.codeSent(format(digits))}</p>

        <label className="mt-xl block" htmlFor="code">
          <span className={fieldLabel}>{loginPage.codeLabel}</span>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={stage.otp.codeLength}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            placeholder="0000"
            aria-invalid={error?.scope === 'code'}
            className={`mt-sm block w-40 tabular-nums ${field(error?.scope === 'code')}`}
          />
        </label>
        {error ? (
          <p className={`mt-xs ${errorTextClass}`}>{error.text}</p>
        ) : (
          probeVisible && <p className={`mt-xs ${hintText}`}>{probeHint.code}</p>
        )}

        <button type="button" onClick={submit} disabled={busy} className={`mt-xl block ${buttonFilled}`}>
          {busy ? loginPage.entering : loginPage.submit}
        </button>

        <div className="mt-lg flex flex-wrap items-center gap-md">
          <button type="button" onClick={resend} disabled={busy || cooldown > 0} className={buttonText}>
            {cooldown > 0 ? loginPage.resendIn(cooldown) : loginPage.resend}
          </button>
          <button
            type="button"
            onClick={() => {
              setCode('')
              setError(null)
              setStage({ kind: 'phone' })
            }}
            className={buttonText}
          >
            {loginPage.changePhone}
          </button>
        </div>
      </MasterShell>
    )
  }

  return (
    <MasterShell>
      <h1 className="text-heading tracking-heading font-semibold">{loginPage.title}</h1>
      <p className="mt-lg max-w-[58ch] text-body tracking-body">{loginPage.body}</p>

      <label className="mt-xl block" htmlFor="phone">
        <span className={fieldLabel}>{loginPage.phoneLabel}</span>
        <span className="mt-sm block">
          <PhoneInput
            id="phone"
            value={digits}
            onChange={setDigits}
            invalid={error?.scope === 'phone'}
          />
        </span>
      </label>
      {error ? (
        <p className={`mt-xs ${errorTextClass}`}>{error.text}</p>
      ) : (
        probeVisible && (
          <p className={`mt-xs max-w-[58ch] ${hintText}`}>
            {probeHint.phones} {probeHint.phonesMore}
          </p>
        )
      )}

      <button type="button" onClick={requestCode} disabled={busy} className={`mt-xl block ${buttonFilled}`}>
        {busy ? loginPage.requesting : loginPage.requestCode}
      </button>
    </MasterShell>
  )
}

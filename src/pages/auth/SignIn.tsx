// US-17, US-29 — вход. Одна дверь на обе роли (решение PM 20.09): человек
// вводит номер, сервер сам решает, что ему доступно. Две стадии на одной
// странице — номер, потом код; отдельным роутом для кода не делаем
// и модальным окном тоже: модальных окон в системе нет, шаг показывается
// стадией той же страницы (DESIGN.md § Layout).
//
// Пароля нет вовсе, и это решение, а не упрощение: Марат отвечает на заявки
// с телефона между цехом и замерами. Пароль он забудет или запишет на коробке.
// Заказчице пароль не нужен тем более — её главный путь остаётся прежним,
// по ссылке из сообщения, без всякого входа (US-11, US-21).
//
// Куда ведёт после входа. Пришёл на /master (или по ссылке из уведомления)
// — в кабинет мастерской; пришёл просто «Войти» — к своим заявкам. Роль
// при этом не спрашивается: у человека может быть обе, и выбирать
// из собственных ролей — работа, которую продукт перекладывает на него.
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { PageShell } from '../../components/PageShell'
import { PhoneInput } from '../../components/PhoneInput'
import { format } from '../../components/phone'
import {
  buttonFilled,
  buttonText,
  errorTextClass,
  field,
  fieldLabel,
  hintText,
  link,
} from '../../components/ui'
import type { OtpSent } from '../../contract'
import { errorText } from '../../texts/request'
import { loginPage } from '../../texts/master'
import { probeText } from '../../texts/probe'
import { POLICY_VERSION, consentRow } from '../../texts/privacy'
import { hasRole, readSession, writeSession } from '../../session'

type Stage =
  | { kind: 'phone' }
  | { kind: 'code'; phone: string; otp: OtpSent }
  /**
   * Вошёл, но мастерской не оказался. Это не ошибка и не тупик: человек
   * вошёл как заказчик, и ему говорят об этом словами, а не отправляют
   * обратно на ввод номера (правка 20.09).
   */
  | { kind: 'notMaster' }

export default function SignIn() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  /**
   * Подсказка двери: человек пришёл на /master или по ссылке с `?as=master`
   * — значит, шёл в кабинет мастерской. Это подсказка, а не право доступа:
   * роли всё равно решает сервер по номеру.
   */
  const asMaster = pathname === '/master' || params.get('as') === 'master'
  // Хранилище читается один раз при монтировании: разбирать его схемой
  // на каждый рендер незачем, а войти за время жизни этого экрана можно
  // только через него же.
  const [session] = useState(() => readSession())
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

  // Вошедшему на этом экране делать нечего. Куда именно — по его ролям:
  // мебельщик к заявкам, заказчик к своим.
  //
  // Кроме одного случая: пришёл на дверь мастерской, а роли нет. Молча
  // увезти его в свой кабинет нельзя — он шёл в другое место и не поймёт,
  // куда попал. Стадия ниже говорит это словами.
  if (session !== null && !(asMaster && !hasRole(session, 'master'))) {
    return <Navigate to={hasRole(session, 'master') && asMaster ? '/master/requests' : '/me'} replace />
  }

  const phone = `+7${digits}`
  /**
   * Согласие уходит вместе с запросом кода. Человек может войти, не оставив
   * ни одной заявки, — и тогда у продукта появился бы телефон без записи
   * о правовом основании (US-11, спека §8). Строка о политике стоит
   * над кнопкой, как на форме заявки.
   */
  const consent = { policyVersion: POLICY_VERSION, acceptedAt: new Date().toISOString() }

  function report(caught: unknown, scope: 'phone' | 'code' | 'form') {
    if (!isApiError(caught)) return setError({ scope: 'form', text: errorText.INTERNAL })
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
    api.authRequestCode({ phone, consent }).then(
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
    api.authRequestCode({ phone, consent }).then(
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
    api.authConfirmCode({ phone, code }).then(
      (opened) => {
        setBusy(false)
        writeSession(opened)
        // Шёл в кабинет мастерской, а роли нет — говорим словами и даём
        // выход к своим заявкам. Раньше такой человек упирался в «номера
        // нет в списке» ещё до кода и не знал, каким номером входить.
        if (asMaster && !opened.roles.includes('master')) {
          return setStage({ kind: 'notMaster' })
        }
        navigate(opened.roles.includes('master') && asMaster ? '/master/requests' : '/me', {
          replace: true,
        })
      },
      (caught: unknown) => {
        setBusy(false)
        report(caught, 'code')
      },
    )
  }

  if (stage.kind === 'notMaster' || (session !== null && asMaster)) {
    return (
      <PageShell>
        <h1 className="text-heading tracking-heading font-semibold">{loginPage.notMasterTitle}</h1>
        <p className="mt-lg max-w-measure text-body tracking-body">{loginPage.notMasterBody}</p>
        {/* Тупик обязан говорить, что подходит: без этого на пробе человек
            упирается в «нет в списке» и не знает, каким номером войти. */}
        {probeText !== null && (
          <p className={`mt-lg max-w-measure ${hintText}`}>
            {probeText.phones} {probeText.phonesMore}
          </p>
        )}
        <button type="button" onClick={() => navigate('/me', { replace: true })}
          className={`mt-xl ${buttonFilled}`}>
          {loginPage.notMasterGo}
        </button>
      </PageShell>
    )
  }

  if (stage.kind === 'code') {
    return (
      <PageShell>
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
            className={`mt-sm block w-[10rem] tabular-nums ${field(error?.scope === 'code')}`}
          />
        </label>
        {error ? (
          <p className={`mt-xs ${errorTextClass}`}>{error.text}</p>
        ) : (
          probeText !== null && <p className={`mt-xs ${hintText}`}>{probeText.code}</p>
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
      </PageShell>
    )
  }

  return (
    <PageShell>
      <h1 className="text-heading tracking-heading font-semibold">{loginPage.title}</h1>
      <p className="mt-lg max-w-measure text-body tracking-body">{loginPage.body}</p>

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
        probeText !== null && (
          <p className={`mt-xs max-w-measure ${hintText}`}>
            {probeText.phones} {probeText.phonesMore}
          </p>
        )
      )}

      {/* Согласие уходит вместе с запросом кода, значит человек обязан
          прочитать об этом до нажатия, а не после (US-11, спека §8).
          Строкой, а не чекбоксом: на форме заявки отметка обязательна,
          потому что там человек отдаёт номер вместе с заказом; здесь
          действие одно — «войти», и отдельная галочка к нему добавляет
          шаг, не добавляя выбора. Ссылка ведёт на ту же политику. */}
      <p className={`mt-xl max-w-measure ${hintText}`}>
        {loginPage.consentNote}{' '}
        <Link to="/privacy" target="_blank" rel="noreferrer" className={link}>
          {consentRow.linkText}
        </Link>
      </p>

      <button type="button" onClick={requestCode} disabled={busy} className={`mt-lg block ${buttonFilled}`}>
        {busy ? loginPage.requesting : loginPage.requestCode}
      </button>
    </PageShell>
  )
}

// US-21 — потерянная ссылка. Ссылка на предложения — единственный вход
// заказчицы: регистрации нет, пропуск — сама строка в адресе (контракт §3).
// Пока этого экрана не было, закрытая вкладка стоила ей всех предложений:
// заявка есть, КП есть, дойти до них нечем.
//
// Экран НЕ говорит, нашлась заявка или нет. Это не скрытность ради
// скрытности: иначе форма становится проверкой «оставлял ли этот человек
// заявку» по чужому номеру. Та же дисциплина, что у входа мебельщика (§5б).
//
// Кода подтверждения здесь нет: сообщение уходит на сам номер, владение
// телефоном и есть подтверждение. Лишний шаг стоял бы ровно там, где человек
// уже растерян — он потерял ссылку и ищет, куда нажать.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { probeLinkFor } from '../../api/mocks'
import { PageShell } from '../../components/PageShell'
import { PhoneInput } from '../../components/PhoneInput'
import { format, PHONE_PREFIX } from '../../components/phone'
import { buttonFilled, errorTextClass, hintText, link, panel } from '../../components/ui'
import type { LinkResent } from '../../contract'
import { Phone } from '../../contract'
import { phone as phoneAsk } from '../../questions/categories'
import { errorText, lostLinkPage } from '../../texts/request'
import { probeVisible } from '../../texts/master'

type Sent = { result: LinkResent; phone: string }

export default function LostLink() {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<Sent | null>(null)
  /**
   * Сколько секунд осталось до повторной отправки. Экран обязан не только
   * назвать ограничение, но и соблюдать его: строка «можно через 30 секунд»
   * рядом с нажимаемой кнопкой — обещание, которого интерфейс не держит.
   */
  const [waitSec, setWaitSec] = useState(0)

  useEffect(() => {
    if (waitSec <= 0) return
    const timer = setTimeout(() => setWaitSec((left) => left - 1), 1000)
    return () => clearTimeout(timer)
  }, [waitSec])

  function send() {
    const phone = `${PHONE_PREFIX}${digits}`
    if (!Phone.safeParse(phone).success) {
      setError(phoneAsk.errorInvalid)
      return
    }
    setSending(true)
    setError(null)
    api.resendLink({ phone }).then(
      (result) => {
        setSending(false)
        setSent({ result, phone })
        setWaitSec(result.retryAfterSec)
      },
      (failure: unknown) => {
        setSending(false)
        setError(isApiError(failure) ? errorText[failure.code] : errorText.NETWORK)
      },
    )
  }

  if (sent !== null) {
    // PROBE: мессенджера в пробе нет, и ссылку иначе никак не получить.
    // Снимается вместе с моками — probeVisible завязан на VITE_USE_MOCKS.
    const probeLink = probeVisible ? probeLinkFor(sent.phone) : null

    return (
      <PageShell>
        <p className={hintText}>{lostLinkPage.label}</p>
        <h1 className="mt-xs max-w-measure-title text-heading tracking-heading font-semibold">
          {lostLinkPage.sentTitle}
        </h1>
        <p className="mt-lg max-w-measure text-body tracking-body">
          {lostLinkPage.sentBody(
            lostLinkPage.channelName[sent.result.channel],
            format(digits),
          )}
        </p>

        {probeVisible && (
          <div className={`mt-xl ${panel}`}>
            <p className={`max-w-measure ${hintText}`}>
              {probeLink === null ? lostLinkPage.probeNone : lostLinkPage.probeNote}
            </p>
            {probeLink !== null && (
              <p className="mt-sm">
                <Link to={probeLink} className={link}>
                  {lostLinkPage.probeOpen}
                </Link>
              </p>
            )}
          </div>
        )}

        {waitSec > 0 && (
          <p className={`mt-3xl max-w-measure ${hintText}`}>{lostLinkPage.againIn(waitSec)}</p>
        )}
        <button
          type="button"
          disabled={waitSec > 0}
          className={`${waitSec > 0 ? 'mt-sm' : 'mt-3xl'} ${buttonFilled}`}
          onClick={() => {
            setSent(null)
          }}
        >
          {lostLinkPage.again}
        </button>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <p className={hintText}>{lostLinkPage.label}</p>
      <h1 className="mt-xs max-w-measure-title text-heading tracking-heading font-semibold">
        {lostLinkPage.title}
      </h1>
      <p className="mt-lg max-w-measure text-body tracking-body">{lostLinkPage.lede}</p>

      <div className={`mt-3xl ${panel}`}>
        <PhoneInput
          id="phone"
          value={digits}
          label={phoneAsk.question}
          invalid={error !== null}
          describedBy="phone-note"
          onChange={(next) => {
            setDigits(next)
            setError(null)
          }}
        />
        {error !== null && (
          <p id="phone-note" className={`mt-xs ${errorTextClass}`}>
            {error}
          </p>
        )}
      </div>

      {/* Главное действие в конце экрана (§ Порядок важнее полноты). Надпись
          на время ожидания меняется: отклик дольше 400 мс обязан показать,
          что он идёт (§ Отклик). */}
      <button type="button" onClick={send} disabled={sending} className={`mt-xl ${buttonFilled}`}>
        {sending ? lostLinkPage.sending : lostLinkPage.action}
      </button>
    </PageShell>
  )
}

// US-16 — «заявка принята». Номер, что будет дальше по статусу и ссылка,
// которую можно переслать. Состояние приходит из навигации (location.state):
// localStorage и sessionStorage запрещены (спека §8, US-11, контракт §7).
// Точность важна: состояние навигации живёт в history.state, то есть токен
// переживает перезагрузку этой вкладки — и это нужное поведение, F5 не должен
// терять единственную ссылку. Телефона в состоянии нет, и это главное.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PageShell } from '../../components/PageShell'
import { absoluteUrl } from '../../router-mode'
import { rememberRequest } from '../../probe-trail'
import { RequestNumber, RequestStatus, Token } from '../../contract'
import type { RequestStatus as RequestStatusValue } from '../../contract'
import { buttonFilled, buttonText, errorTextClass, hintText, link } from '../../components/ui'
import { sentPage, statusNote } from '../../texts/request'

interface SentState {
  number: string
  token: string
  status: RequestStatusValue
}

/** Пришедшее из навигации проверяется схемами контракта, а не принимается на слово. */
function readState(raw: unknown): SentState | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const number = RequestNumber.safeParse(value.number)
  const token = Token.safeParse(value.token)
  const status = RequestStatus.safeParse(value.status)
  if (!number.success || !token.success || !status.success) return null
  return { number: number.data, token: token.data, status: status.data }
}

export default function RequestSent() {
  const location = useLocation()
  const state = readState(location.state)
  /**
   * Тихий успех: подпись кнопки меняется на «Скопировали» и возвращается
   * сама (DESIGN.md § Отклик — всплывающих сообщений об успехе не заводим).
   */
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  // Подпись возвращается сама через две секунды: это подтверждение, а не
  // состояние кнопки — нажать «Скопировать» второй раз должно быть можно.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  // Прямой заход по адресу: номера и ссылки взять неоткуда и хранить их
  // было нельзя. Говорим честно, куда ушла ссылка.
  if (!state) {
    return (
      <PageShell>
        <h1 className="max-w-measure-title font-display text-heading tracking-heading font-bold">{sentPage.fallbackTitle}</h1>
        <p className="mt-lg max-w-measure text-body tracking-body">{sentPage.fallbackBody}</p>
      </PageShell>
    )
  }

  const note = statusNote[state.status]
  const path = `/offers/${state.token}`
  // PROBE: след для панели пробы на лендинге — чтобы вернуться к своим
  // предложениям внутренним переходом, не перезагружая вкладку.
  rememberRequest(state.token, state.number)
  // Ссылку пересылают целиком, поэтому показываем её абсолютной — и собираем
  // с учётом роутера: на статическом хостинге путь живёт за решёткой,
  // иначе пересланный адрес открывает пустоту (src/router-mode.ts).
  const absolute = absoluteUrl(path)

  /**
   * Копирование. Ошибка бывает настоящая: буфер закрыт в приватном окне
   * и в старых webview, и молчать про неё нельзя — человек нажмёт, ничего
   * не произойдёт, и он решит, что ссылки у него больше нет.
   */
  function copyLink() {
    setCopyError(false)
    navigator.clipboard.writeText(absolute).then(
      () => setCopied(true),
      () => setCopyError(true),
    )
  }

  return (
    <PageShell>
      <h1 className="max-w-measure-title font-display text-heading tracking-heading font-bold">{sentPage.title}</h1>

      {/* Первым — что теперь будет. Номер заявки стоял здесь крупнее всего
          на экране, хотя в эту секунду человек спрашивает не «как меня
          зовут в системе», а «что дальше». Номер переехал вниз. */}
      <section className="mt-3xl">
        <h2 className="text-subheading tracking-subheading font-medium">{note.title}</h2>
        <p className="mt-sm max-w-measure text-body tracking-body">{note.body}</p>
      </section>

      {/* Заголовок, пояснение и сама строка — одно целое, поэтому плашка
          первого уровня. Строка ссылки вложена в неё вторым уровнем: на холсте
          второй уровень стоять не может, он по определению «вложенное в блок»
          (DESIGN.md § Elevation). */}
      {/* Вторая редакция системы: заголовок раздела стоит СНАРУЖИ плашки
          и называет её, а плашка держит только элементы — здесь саму строку
          ссылки и кнопку. Раньше заголовок сидел внутри, и блок читался
          как карточка с шапкой, а не как раздел под заголовком. */}
      <section className="mt-3xl">
        <h2 className="text-subheading tracking-subheading font-medium">{sentPage.linkTitle}</h2>
        <p className={`mt-sm max-w-measure ${hintText}`}>{sentPage.linkNote}</p>
        {/* Адрес на экране не показывается: он и есть ключ к заявке
            (контракт §3, §7), а открытый во всю ширину читается через плечо
            и попадает в чужие кадры. Переслать его можно кнопкой. */}
        <div className="mt-lg flex flex-wrap items-center gap-md">
          <Link to={path} className={`whitespace-nowrap ${buttonFilled}`}>
            {sentPage.linkOpen}
          </Link>
          <button type="button" className={buttonText} onClick={copyLink}>
            {copied ? sentPage.linkCopied : sentPage.linkCopy}
          </button>
        </div>
        {copyError && <p className={`mt-sm max-w-measure ${errorTextClass}`}>{sentPage.linkCopyFailed}</p>}

        {/* US-21: адрес выше — единственный вход, и теряется он именно здесь,
            вместе с закрытой вкладкой. Второстепенное действие рядом с главным:
            ссылкой, а не кнопкой, чтобы не спорить с «Открыть предложения». */}
        <p className="mt-xl">
          <Link to="/link" className={link}>
            {sentPage.lostLink}
          </Link>
        </p>
      </section>

      {/* Номер — служебное, и стоит там, где его ищут: когда уже говорят
          с мастерской. Ступень body, а не heading: это не то, ради чего
          человек открыл экран. */}
      <section className="mt-3xl">
        <p className={hintText}>{sentPage.numberLabel}</p>
        <p className="mt-xs text-body tracking-body font-medium tabular-nums">{state.number}</p>
        <p className={`mt-xs max-w-measure ${hintText}`}>{sentPage.numberNote}</p>
      </section>
    </PageShell>
  )
}

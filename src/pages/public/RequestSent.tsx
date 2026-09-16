// US-16 — «заявка принята». Номер, что будет дальше по статусу и ссылка,
// которую можно переслать. Состояние приходит из навигации (location.state):
// localStorage и sessionStorage запрещены (спека §8, US-11, контракт §7).
// Точность важна: состояние навигации живёт в history.state, то есть токен
// переживает перезагрузку этой вкладки — и это нужное поведение, F5 не должен
// терять единственную ссылку. Телефона в состоянии нет, и это главное.
import { Link, useLocation } from 'react-router-dom'
import { PageShell } from '../../components/PageShell'
import { RequestNumber, RequestStatus, Token } from '../../contract'
import type { RequestStatus as RequestStatusValue } from '../../contract'
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

  // Прямой заход по адресу: номера и ссылки взять неоткуда и хранить их
  // было нельзя. Говорим честно, куда ушла ссылка.
  if (!state) {
    return (
      <PageShell>
        <h1 className="max-w-[20ch] text-heading tracking-heading">{sentPage.fallbackTitle}</h1>
        <p className="mt-lg max-w-[58ch] text-body tracking-body">{sentPage.fallbackBody}</p>
      </PageShell>
    )
  }

  const note = statusNote[state.status]
  const path = `/offers/${state.token}`
  // Ссылку пересылают целиком, поэтому показываем её абсолютной.
  const absolute = `${window.location.origin}${path}`

  return (
    <PageShell>
      <h1 className="max-w-[20ch] text-heading tracking-heading">{sentPage.title}</h1>

      <section className="mt-xl border-t border-outline py-xl">
        <p className="text-body-sm tracking-body-sm">{sentPage.numberLabel}</p>
        <p className="mt-sm text-heading tracking-heading tabular-nums">{state.number}</p>
        <p className="mt-md max-w-[58ch] text-body-sm tracking-body-sm">{sentPage.numberNote}</p>
      </section>

      <section className="border-t border-outline py-xl">
        <h2 className="text-subheading tracking-subheading">{note.title}</h2>
        <p className="mt-sm max-w-[62ch] text-body tracking-body">{note.body}</p>
      </section>

      <section className="border-t border-outline py-xl">
        <h2 className="text-subheading tracking-subheading">{sentPage.linkTitle}</h2>
        <p className="mt-sm max-w-[62ch] text-body-sm tracking-body-sm">{sentPage.linkNote}</p>
        <p className="mt-lg max-w-full overflow-x-auto border-b border-outline px-xs py-sm text-body-sm tracking-body-sm break-all">
          {absolute}
        </p>
        <Link to={path}
          className="mt-lg inline-block bg-primary px-2xl py-lg text-caps tracking-caps
            whitespace-nowrap text-on-primary uppercase transition-opacity duration-100
            hover:opacity-80 active:opacity-70">
          {sentPage.linkOpen}
        </Link>
      </section>
    </PageShell>
  )
}

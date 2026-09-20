// US-29 — кабинет заказчика: все свои заявки одним списком (§5в).
//
// Зачем он появился 20.09. Заявка открывалась только по ссылке из сообщения:
// один раз оставил — одна ссылка, потерял переписку — потерял предложения.
// Это законный путь и он остаётся главным (US-11, US-21): по ссылке заявку
// открывает и муж, которому её переслали, и человек, не желающий вводить
// никаких кодов. Кабинет — второй путь к тем же данным для того, кто
// согласен один раз подтвердить свой номер.
//
// Что здесь НЕ показывается: неподтверждённые заявки. Номер в форме вписывает
// кто угодно, и в чужом кабинете появилась бы «его» кухня.
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { PageShell } from '../../components/PageShell'
import { CategoryIcon } from '../../components/CategoryIcon'
import { ChevronIcon } from '../../components/icons'
import { blockRow, blockRowDivider, buttonFilled, buttonText, hintText, stepPanel } from '../../components/ui'
import type { RequestForClientListItem, Session } from '../../contract'
import { categories, cityName, metersUnit } from '../../questions/categories'
import { clearSession, readSession } from '../../session'
import { errorText } from '../../texts/request'
import { myRequestsPage } from '../../texts/client'
import { routedAtLabel } from '../../texts/master'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; items: RequestForClientListItem[] }
  | { kind: 'failed'; message: string }

const categoryLabel = (id: RequestForClientListItem['category']): string =>
  categories.find((category) => category.id === id)?.label ?? ''

/**
 * Строка заявки. Тот же строй, что в кабинете мебельщика (§ Components):
 * иконка категории слева, что заказано, под ним где и когда, шеврон справа.
 * Два кабинета одного продукта обязаны читаться одинаково.
 */
function RequestRow({ item }: { item: RequestForClientListItem }) {
  const size = item.mainSize.known
    ? `${String(item.mainSize.meters).replace('.', ',')} ${metersUnit(item.mainSize.meters)}`
    : myRequestsPage.sizeUnknown

  return (
    <div className={blockRowDivider()}>
      <Link to={`/offers/${item.token}`}
        aria-label={`${categoryLabel(item.category)}, ${size} — ${myRequestsPage.open} ${item.number}`}
        className={blockRow(false)}>
        <span className="self-start">
          <CategoryIcon id={item.category} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body tracking-body font-medium">
            {categoryLabel(item.category)}, {size}
          </span>
          {/* Сколько предложений — главное, ради чего человек сюда зашёл.
              Ноль называется словами: пустое место он прочитает как сбой. */}
          <span className={`mt-xs block ${hintText}`}>
            {item.quotesCount === 0
              ? myRequestsPage.noQuotes
              : myRequestsPage.quotes(item.quotesCount)}
          </span>
          <span className={`block tabular-nums ${hintText}`}>
            {cityName(item.city)} · {routedAtLabel(item.createdAt)}
          </span>
        </span>
        <ChevronIcon />
      </Link>
    </div>
  )
}

export default function MyRequests() {
  const [session, setSession] = useState<Session | null>(() => readSession())
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (session === null) return
    api.listMyRequests(session.token).then(
      (items) => setView({ kind: 'ready', items }),
      (caught: unknown) => {
        if (!isApiError(caught)) return setView({ kind: 'failed', message: errorText.INTERNAL })
        // Сессия кончилась — экран не показывает чужих данных и не делает
        // вид, что заявок нет: он возвращает ко входу.
        if (caught.code === 'UNAUTHORIZED') {
          clearSession()
          setSession(null)
          return
        }
        setView({ kind: 'failed', message: errorText[caught.code] })
      },
    )
  }, [session, attempt])

  if (session === null) return <Navigate to="/login" replace />

  if (view.kind === 'loading') {
    return (
      <PageShell>
        <p className="text-body tracking-body" role="status">{myRequestsPage.loading}</p>
      </PageShell>
    )
  }

  if (view.kind === 'failed') {
    return (
      <PageShell>
        <h1 className="text-heading tracking-heading font-semibold">{myRequestsPage.failedTitle}</h1>
        <p className="mt-lg max-w-measure text-body tracking-body">{view.message}</p>
        <button type="button" className={`mt-xl ${buttonFilled}`}
          onClick={() => {
            setView({ kind: 'loading' })
            setAttempt((n) => n + 1)
          }}>
          {myRequestsPage.retry}
        </button>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-baseline justify-between gap-x-lg gap-y-sm">
        <span>
          <span className={`block ${hintText}`}>{myRequestsPage.label}</span>
          <h1 className="mt-xs text-heading tracking-heading font-semibold">
            {myRequestsPage.title}
          </h1>
        </span>
        {/* Выход. Без него кабинет — ловушка: сменить номер нельзя вовсе,
            а на чужом телефоне сессия живёт двенадцать часов. */}
        <button type="button" className={buttonText}
          onClick={() => {
            // Отзываем на сервере, а не только чистим вкладку: иначе токен
            // остаётся действующим ключом до конца срока.
            void api.signOut(session.token).catch(() => undefined)
            clearSession()
            setSession(null)
          }}>
          {myRequestsPage.signOut}
        </button>
      </div>

      {view.items.length === 0 ? (
        // Пустое состояние говорит словами и даёт выход (§ Presence).
        // Заявок нет не потому, что сломалось: человек просто ещё не оставил.
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">
            {myRequestsPage.emptyTitle}
          </h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{myRequestsPage.emptyBody}</p>
          <Link to="/request" className={`mt-xl inline-flex ${buttonFilled}`}>
            {myRequestsPage.toRequest}
          </Link>
        </section>
      ) : (
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">
            {myRequestsPage.listTitle(view.items.length)}
          </h2>
          <div className={`mt-lg ${stepPanel} py-sm`}>
            {view.items.map((item) => (
              <RequestRow key={item.number} item={item} />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  )
}

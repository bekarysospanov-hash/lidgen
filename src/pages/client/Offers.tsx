// US-21 — страница предложений по токену. Вход без регистрации: доступ даёт
// владение строкой из ссылки (контракт §3, §7). Токен берётся из адреса
// и никуда не сохраняется — хранить его в браузере запрещено (спека §8).
// Рендер карточек КП — US-22; здесь обязаны быть честными состояния:
// загрузка, нерабочая ссылка, обрыв связи и пустой список.
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { PageShell } from '../../components/PageShell'
import { Token } from '../../contract'
import type { RequestForClient } from '../../contract'
import { buttonFilled, hintText, panel } from '../../components/ui'
import { errorText, offersPage, statusNote } from '../../texts/request'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; request: RequestForClient }
  | { kind: 'invalid' }
  | { kind: 'network' }
  | { kind: 'failed'; message: string }

/** Ошибка → состояние экрана. Ключуемся по code, не по HTTP-статусу (§6). */
function toView(caught: unknown): View {
  if (!isApiError(caught)) return { kind: 'failed', message: errorText.INTERNAL }
  if (caught.code === 'TOKEN_INVALID') return { kind: 'invalid' }
  if (caught.code === 'NETWORK') return { kind: 'network' }
  return { kind: 'failed', message: errorText[caught.code] }
}

/** Заголовок экрана: крупно, обычным регистром, вес 600 (§ Typography). */
function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="max-w-[20ch] text-heading tracking-heading font-semibold">{children}</h1>
}

export default function Offers() {
  const { token } = useParams()
  /**
   * Токен из адреса проверяется схемой контракта до вызова: строка из URL —
   * это чужой ввод. Ответ на мусор всё равно был бы TOKEN_INVALID, но гонять
   * заведомо негодную строку на сервер незачем (контракт §3, Token).
   */
  const valid = token !== undefined && Token.safeParse(token).success

  const [view, setView] = useState<View>({ kind: 'loading' })
  /** Счётчик попыток: «Повторить» просто просит эффект сходить ещё раз. */
  const [attempt, setAttempt] = useState(0)
  /**
   * Под StrictMode эффект в деве исполняется дважды. Без этой отметки мок
   * писал бы два client_page_opened на одно открытие — воронка US-25a
   * считалась бы вдвое. Отметка ключуется токеном и номером попытки:
   * «Повторить» обязано сходить на сервер заново, повторный монтаж — нет.
   *
   * Устаревший ответ отсекается той же отметкой, а НЕ флагом из замыкания
   * эффекта: под StrictMode уборка первого прогона погасила бы такой флаг,
   * второй прогон запрос не повторил бы — и экран навсегда остался бы
   * на «Загружаем заявку». Ключ переживает уборку, флаг — нет.
   */
  const fetchedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!valid || token === undefined) return
    const key = `${token}|${attempt}`
    if (fetchedFor.current === key) return
    fetchedFor.current = key

    const current = () => fetchedFor.current === key
    api.getRequestByToken(token).then(
      (request) => { if (current()) setView({ kind: 'ready', request }) },
      (caught: unknown) => { if (current()) setView(toView(caught)) },
    )
  }, [token, attempt, valid])

  function retry() {
    setView({ kind: 'loading' })
    setAttempt((count) => count + 1)
  }

  // Ссылку выдаём заново не здесь: механизма «прислать ссылку по номеру»
  // в срезе 1 нет (контракт §9, US-21). Кнопки, которая никуда не ведёт,
  // на экране быть не должно.
  if (!valid || view.kind === 'invalid') {
    return (
      <PageShell>
        <Title>{offersPage.invalidTitle}</Title>
        <p className="mt-lg max-w-[58ch] text-body tracking-body">{offersPage.invalidBody}</p>
      </PageShell>
    )
  }

  if (view.kind === 'loading') {
    return (
      <PageShell>
        <p className="text-body tracking-body" role="status">{offersPage.loading}</p>
      </PageShell>
    )
  }

  if (view.kind === 'network' || view.kind === 'failed') {
    const network = view.kind === 'network'
    return (
      <PageShell>
        <Title>{network ? offersPage.networkTitle : offersPage.failedTitle}</Title>
        <p className="mt-lg max-w-[58ch] text-body tracking-body">
          {network ? offersPage.networkBody : view.message}
        </p>
        <button type="button" onClick={retry}
          className={`mt-xl whitespace-nowrap ${buttonFilled}`}>
          {offersPage.retry}
        </button>
      </PageShell>
    )
  }

  const { request } = view
  const note = statusNote[request.status]

  return (
    <PageShell>
      <p className={hintText}>{offersPage.numberLabel}</p>
      <h1 className="mt-xs text-heading tracking-heading font-semibold tabular-nums">
        {request.number}
      </h1>

      {/* Статус заявки — «следы процесса»: человек должен видеть, что она
          движется, а не лежит (DESIGN.md § Presence). */}
      <section className="mt-3xl">
        <div className={panel}>
          <h2 className="text-subheading tracking-subheading font-medium">{note.title}</h2>
          <p className="mt-sm max-w-[62ch] text-body tracking-body">{note.body}</p>
        </div>
      </section>

      <section className="mt-3xl">
        {request.quotes.length === 0 ? (
          <>
            {/* Пустое состояние говорит словами, а не серым прямоугольником. */}
            <h2 className="text-subheading tracking-subheading font-medium">{offersPage.emptyTitle}</h2>
            <p className="mt-sm max-w-[62ch] text-body tracking-body">{offersPage.emptyBody}</p>
          </>
        ) : (
          <>
            <h2 className="text-subheading tracking-subheading font-medium">{offersPage.quotesHere}</h2>
            <p className="mt-sm text-body tracking-body tabular-nums">{request.quotes.length}</p>
          </>
        )}
      </section>
    </PageShell>
  )
}

// US-21 — страница предложений по токену. Вход без регистрации: доступ даёт
// владение строкой из ссылки (контракт §3, §7). Токен берётся из адреса
// и никуда не сохраняется — хранить его в браузере запрещено (спека §8).
// Одно КП показывается целиком и без интерфейса сравнения — это US-21,
// срез 1; сравнение и накопление включаются от двух предложений (US-22,
// срез 3). Состояния обязаны быть честными: загрузка, нерабочая ссылка,
// обрыв связи и пустой список.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { PageShell } from '../../components/PageShell'
import { Token } from '../../contract'
import type { Quote, QuoteItem, RequestForClient } from '../../contract'
import {
  compositionLabels,
  compositionShown,
  splitComposition,
} from '../../questions/composition'
import { buttonFilled, fieldLabel, hintText, link, panel, panelNested } from '../../components/ui'
import { trackForRequest } from '../../analytics'
import { probeText } from '../../texts/probe'
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
  return <h1 className="max-w-measure-title text-heading tracking-heading font-semibold">{children}</h1>
}

/**
 * Одно предложение целиком (US-21). Имя мастерской и вилка — крупно: ради
 * них человек и открывает ссылку, и это те самые «настоящие числа и имена»,
 * которые дают ощущение присутствия, а не заглушки (DESIGN.md § Presence).
 */
function QuoteCard({
  quote,
  requestNumber,
}: {
  quote: Quote
  requestNumber: string
}) {
  /**
   * US-24. Телефон показывается по нажатию, а не сразу: пока заказчица
   * не выбрала, к кому идти, три номера на экране — не помощь, а давление.
   * Нажатие пишет событие «вышел на контакт» — нижнюю границу метрики:
   * позвонить можно и мимо продукта, и об этом честно сказано в PRD.
   */
  const [contactShown, setContactShown] = useState(false)
  /** Части предмета и работы порознь: разница в цене чаще лежит во вторых. */
  const shown = splitComposition(quote.composition.items)

  return (
    <div className={panel}>
      <p className="text-subheading tracking-subheading font-medium">{quote.master.name}</p>
      <p className={`mt-xs ${hintText}`}>
        {offersPage.quoteArrived} {arrivedAt(quote.sentAt)}
        {quote.updatedAt !== null && ` · ${offersPage.quoteRevised} ${arrivedAt(quote.updatedAt)}`}
      </p>

      <div className={`mt-lg ${panelNested}`}>
        <p className="text-subheading tracking-subheading font-medium tabular-nums">
          {offersPage.quotePrice(quote.price.minKzt, quote.price.maxKzt)}
        </p>
        <p className={`mt-xs ${hintText}`}>
          {offersPage.quoteLead}: {offersPage.quoteLeadValue(quote.leadTimeDays)}
        </p>
      </div>

      {/* Отмеченное перечисляется строками, неотмеченное не показывается:
          перечислять отсутствующее по одному предложению незачем — для этого
          есть таблица ниже, где «нет» имеет смысл рядом с чужим «есть».
          Строки, а не чипсы: чипс в системе несёт выбор, а выбирать здесь
          нечего, и некликабельное не должно притворяться (§ Affordance). */}
      <p className={`mt-xl ${fieldLabel}`}>{offersPage.quoteWhat}</p>
      {/* Чей ответ главнее — здесь, а не когда человек заметит расхождение
          с карточкой мастерской сам (разбор с PM, 18.09). */}
      <p className={`mt-xs max-w-measure ${hintText}`}>{offersPage.quoteWhatNote}</p>
      {/* Двумя группами: позиций бывает до девятнадцати, а список длиннее
          восьми строк система запрещает — линии сливаются в штриховку.
          Работы отделены от частей предмета намеренно: разница в цене чаще
          лежит в том, входит ли замер, а не в фасадах. */}
      {([['parts', shown.parts], ['services', shown.services]] as const)
        .filter(([, list]) => list.length > 0)
        .map(([group, list]) => (
          <div key={group} className="mt-md first:mt-xs">
            <p className={hintText}>{compositionShown[group]}</p>
            <ul className="mt-xs max-w-measure">
              {list.map((item) => (
                <li key={item} className="mt-xs text-body tracking-body first:mt-0">
                  {compositionLabels[item]}
                </li>
              ))}
            </ul>
          </div>
        ))}

      {quote.composition.extra !== undefined && (
        <>
          <p className={`mt-lg ${fieldLabel}`}>{offersPage.quoteExtra}</p>
          <p className="mt-xs max-w-measure text-body tracking-body">{quote.composition.extra}</p>
        </>
      )}

      <p className={`mt-lg ${fieldLabel}`}>{offersPage.quoteExcluded}</p>
      <p className="mt-xs max-w-measure text-body tracking-body">{quote.composition.excluded}</p>

      <div className="mt-xl">
        {contactShown ? (
          <>
            <p className={fieldLabel}>{offersPage.contactTitle}</p>
            <p className="mt-xs text-subheading tracking-subheading font-medium">
              <a href={`tel:${quote.master.phone}`} className={link}>
                {quote.master.phone}
              </a>
            </p>
            <p className={`mt-sm max-w-measure ${hintText}`}>{offersPage.contactNote}</p>
            <p className={`mt-xs ${hintText}`}>
              {offersPage.numberLabel} {requestNumber}
            </p>
          </>
        ) : (
          <button
            type="button"
            className={buttonFilled}
            onClick={() => {
              setContactShown(true)
              // С привязкой к заявке и без дедупа по типу: обратиться можно
              // к нескольким мебельщикам, и каждый раз это отдельный факт.
              trackForRequest('contact_made', quote.requestId, { masterId: quote.master.id })
            }}
          >
            {offersPage.contactAction}
          </button>
        )}
      </div>
    </div>
  )
}

/** «сегодня, 14:20» — человек смотрит страницу по нескольку раз в день. */
function arrivedAt(iso: string): string {
  const at = new Date(iso)
  const time = at.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const today = new Date().toDateString() === at.toDateString()
  return today
    ? `сегодня, ${time}`
    : at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

/**
 * US-23 — сравнение включается от двух предложений и раньше не нужно:
 * сравнивать одно КП не с чем. Строки одинаковые у всех, пустая говорит
 * «не указано», а не прочерком — прочерк читается как «мебельщик не работает».
 *
 * Таблица — единственное, чему система разрешает быть шире колонки, и то
 * в своём контейнере с горизонтальной прокруткой (DESIGN.md § Layout).
 */
function Compare({ quotes }: { quotes: Quote[] }) {
  // Позиции, отмеченные хотя бы кем-то. Порядок — как в перечне системы,
  // а не как отмечал первый ответивший: иначе таблица меняла бы расположение
  // строк от заявки к заявке, и сравнивать её глазами стало бы труднее.
  const order = Object.keys(compositionLabels) as QuoteItem[]
  const mentioned = order.filter((item) => quotes.some((q) => q.composition.items.includes(item)))

  const rows: [string, (quote: Quote) => string][] = [
    [offersPage.compareRows.price, (q) => offersPage.quotePrice(q.price.minKzt, q.price.maxKzt)],
    [offersPage.compareRows.lead, (q) => offersPage.quoteLeadValue(q.leadTimeDays)],
    // Матрица «у кого что есть» (US-23). Слово, а не значок: галочку и точку
    // разные люди читают по-разному, «есть» и «нет» — одинаково все, а эмодзи
    // система запрещает прямо (DESIGN.md § Иконки).
    ...mentioned.map(
      (item): [string, (quote: Quote) => string] => [
        compositionLabels[item],
        (q) => (q.composition.items.includes(item) ? offersPage.compareIncluded : offersPage.compareMissing),
      ],
    ),
    // Строка «Дополнительно» показывается, только если её кто-то заполнил:
    // строка, где у всех «не указано», ничего не сравнивает и лишь удлиняет
    // таблицу, которую и так приходится листать вбок (§ Content — коротко
    // и по делу). «Что не входит» обязательно у всех, поэтому стоит всегда.
    ...(quotes.some((q) => q.composition.extra !== undefined)
      ? ([[offersPage.compareRows.extra, (q) => q.composition.extra ?? offersPage.compareEmpty]] as [
          string,
          (quote: Quote) => string,
        ][])
      : []),
    [offersPage.compareRows.excluded, (q) => q.composition.excluded],
  ]

  return (
    <div className="mt-lg overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-left">
        <thead>
          <tr>
            <th className={`py-md pr-lg align-top ${hintText}`} />
            {quotes.map((quote) => (
              <th key={quote.id} className="py-md pr-lg align-top text-body tracking-body font-medium">
                {quote.master.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-t border-outline">
              <th scope="row" className={`py-md pr-lg align-top font-normal ${hintText}`}>
                {label}
              </th>
              {quotes.map((quote) => (
                <td key={quote.id} className="py-md pr-lg align-top text-body tracking-body">
                  {value(quote)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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

  // Нерабочая ссылка — не конец пути: заявка и предложения по ней никуда
  // не делись, потерялся только адрес. Отсюда выход на /link (US-21).
  if (!valid || view.kind === 'invalid') {
    return (
      <PageShell>
        <Title>{offersPage.invalidTitle}</Title>
        <p className="mt-lg max-w-measure text-body tracking-body">{offersPage.invalidBody}</p>
        {/* US-21: до этого экран был тупиком — ссылка не работает, и всё.
            Заявка при этом никуда не делась, и предложения по ней тоже. */}
        <Link to="/link" className={`mt-xl inline-flex ${buttonFilled}`}>
          {offersPage.lostLinkAction}
        </Link>
        {probeText !== null && (
          <p className={`mt-lg max-w-measure ${hintText}`}>{probeText.invalidLink}</p>
        )}
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
        <p className="mt-lg max-w-measure text-body tracking-body">
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
          движется, а не лежит (DESIGN.md § Presence). Но когда предложения
          уже пришли, плашка становится лишней: она объявляет «мебельщики
          ответили, откройте ссылку» тому, кто эту ссылку и открыл. Дальше
          за статус говорят сами предложения. */}
      {request.quotes.length === 0 && (
        <section className="mt-3xl">
          {/* Плашки нет: заголовок и абзац самостоятельны, а плашка вокруг
              самостоятельного элемента — шум (DESIGN.md § Elevation). */}
          <h2 className="text-subheading tracking-subheading font-medium">{note.title}</h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{note.body}</p>
        </section>
      )}

      <section className="mt-3xl">
        {request.quotes.length === 0 ? (
          <>
            {/* Пустое состояние говорит словами, а не серым прямоугольником. */}
            <h2 className="text-subheading tracking-subheading font-medium">{offersPage.emptyTitle}</h2>
            <p className="mt-sm max-w-measure text-body tracking-body">{offersPage.emptyBody}</p>
          </>
        ) : (
          <>
            <h2 className="text-subheading tracking-subheading font-medium">{offersPage.quotesHere}</h2>
            {/* Каждое КП — плашка: разнородные поля одного ответа, то самое
                «это одно целое», ради которого плашка и существует.
                Интерфейса сравнения нет — он включается от двух предложений
                и живёт в US-22, срез 3 (PRD, US-21). */}
            {/* Порядок поступления, а не по цене: сортировка по цене —
                уже наш совет, кого выбрать, а мы этого не решаем (US-22). */}
            <ul className="mt-lg flex flex-col gap-xl">
              {[...request.quotes]
                .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
                .map((quote) => (
                  <li key={quote.id}>
                    <QuoteCard quote={quote} requestNumber={request.number} />
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>

      {request.quotes.length >= 2 && (
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{offersPage.compareTitle}</h2>
          <p className={`mt-sm max-w-measure ${hintText}`}>{offersPage.compareNote}</p>
          <Compare quotes={[...request.quotes].sort((a, b) => a.sentAt.localeCompare(b.sentAt))} />
        </section>
      )}

      {request.quotes.length > 0 && (
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{offersPage.nextTitle}</h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{offersPage.nextBody}</p>
        </section>
      )}
    </PageShell>
  )
}

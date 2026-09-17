// US-25a, US-26 — воронка до отправки заявки и источник трафика.
//
// Что фронт отправляет сам, а что нет. События, порождённые операциями
// (`request_submitted`, `otp_requested`, `otp_confirmed`, `routed`,
// `master_opened`, `quote_sent`, `client_page_opened`), пишет сервер: он их
// и так видит, а дублирование с клиента дало бы двойной счёт. Фронту
// принадлежат только четыре события ДО отправки — до них сервер не доживает,
// потому что его ещё никто не звал (контракт §5, FUNNEL_EVENTS).
//
// Идентификатор сессии живёт в памяти вкладки и нигде больше: браузерное
// хранилище запрещено (спека §8, контракт §7). Цена решения названа прямо —
// перезагрузка страницы считается новым визитом, и «зашёл → начал заполнять»
// по ней слегка завышается. Дешевле, чем заводить исключение в правиле ПДн
// ради точности наблюдения на пятнадцати заявках.
import { api } from './api/client'
import type { EventInput, EventType, Source } from './contract'

const sessionId = crypto.randomUUID()

/** Однажды отправленные события воронки: каждое считается один раз за сессию. */
const sent = new Set<EventType>()

/**
 * UTM читается один раз при загрузке и живёт в памяти: человек уходит
 * с рекламного адреса на форму, и к моменту отправки заявки параметров
 * в адресной строке уже нет (US-26).
 */
const source: Source = readSource()

function readSource(): Source {
  const params = new URLSearchParams(window.location.search)
  const value: Source = {}
  const utmSource = params.get('utm_source')
  const utmMedium = params.get('utm_medium')
  const utmCampaign = params.get('utm_campaign')
  const utmContent = params.get('utm_content')
  if (utmSource) value.utmSource = utmSource
  if (utmMedium) value.utmMedium = utmMedium
  if (utmCampaign) value.utmCampaign = utmCampaign
  if (utmContent) value.utmContent = utmContent
  // Реферер нужен, когда метки не проставили: «пришёл из Instagram» лучше,
  // чем «неизвестно», хотя и грубее. Свой же адрес отбрасывается: страница
  // предложений содержит в пути токен, а токен — секрет доступа к заявке
  // (контракт §3), и ему нечего делать в журнале событий.
  const referrer = document.referrer
  if (referrer && !referrer.startsWith(window.location.origin)) value.referrer = referrer
  return value
}

/** Источник для CreateRequest. Пустой объект — законное значение (§2). */
export function requestSource(): Source | undefined {
  return Object.keys(source).length > 0 ? source : undefined
}

/**
 * Визит вместе с метками (US-01). Без них событие бесполезно: два оффера
 * сравниваются именно по тому, из какой кампании пришёл человек, а к моменту
 * отправки заявки метки из адресной строки уже пропали.
 */
export function trackVisit(): void {
  track('visit', requestSource())
}

/**
 * Очередь. Пачкой, а не по одному: на форме события идут подряд, и четыре
 * отдельных запроса за секунду — это четыре повода отвлечь браузер от
 * набора текста.
 */
let queue: EventInput[] = []
let timer: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  if (queue.length === 0) return
  const events = queue
  queue = []
  timer = null
  // Единственная операция, отказ которой глотается молча: наблюдение
  // не должно ломать продукт (контракт §5).
  void api.sendEvents({ events }).catch(() => {})
}

function enqueue(event: EventInput): void {
  queue.push(event)
  if (timer === null) timer = setTimeout(flush, 800)
}

/**
 * Записать событие воронки. Каждое — один раз за сессию: «выбрал категорию»
 * интересно как факт прохождения шага, а не как счётчик кликов по вариантам.
 */
export function track(type: EventType, payload?: Record<string, unknown>): void {
  if (sent.has(type)) return
  sent.add(type)

  enqueue({
    type,
    requestId: null,
    actor: { role: 'client' },
    sessionId,
    ...(payload ? { payload } : {}),
  })
}

/**
 * Событие, привязанное к заявке: «вышел на контакт» (US-24) и подобные.
 * Дедупа по типу здесь нет и быть не может — заказчица выходит на контакт
 * с несколькими мебельщиками, и «к скольким из трёх обратились» это и есть
 * содержание звена 4. requestId обязателен: без него событие не с чем
 * сопоставить (контракт §2, Event).
 */
export function trackForRequest(
  type: EventType,
  requestId: string,
  payload?: Record<string, unknown>,
): void {
  enqueue({
    type,
    requestId,
    actor: { role: 'client' },
    sessionId,
    ...(payload ? { payload } : {}),
  })
}

/**
 * #2 из ревью: очередь ждёт 800 мс, а человек может закрыть вкладку раньше —
 * и теряются ровно те, кто ушёл, не отправив заявку. pagehide срабатывает
 * и при закрытии, и при уходе в фон на телефоне, где visibilitychange
 * остаётся единственным надёжным сигналом.
 */
if (typeof window !== 'undefined') {
  const flushNow = () => flush()
  window.addEventListener('pagehide', flushNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow()
  })
}

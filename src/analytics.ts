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
  // чем «неизвестно», хотя и грубее.
  if (document.referrer) value.referrer = document.referrer
  return value
}

/** Источник для CreateRequest. Пустой объект — законное значение (§2). */
export function requestSource(): Source | undefined {
  return Object.keys(source).length > 0 ? source : undefined
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

/**
 * Записать событие воронки. Каждое — один раз за сессию: «выбрал категорию»
 * интересно как факт прохождения шага, а не как счётчик кликов по вариантам.
 */
export function track(type: EventType, payload?: Record<string, unknown>): void {
  if (sent.has(type)) return
  sent.add(type)

  queue.push({
    type,
    requestId: null,
    actor: { role: 'client' },
    sessionId,
    ...(payload ? { payload } : {}),
  })

  if (timer === null) timer = setTimeout(flush, 800)
}

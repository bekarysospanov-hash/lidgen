// Тесты http-клиента (src/api/http.ts) с подменённым globalThis.fetch.
// Контракт: httpApi реализует тот же интерфейс Api, что и mockApi, читает
// конверт ошибок { error: { code, ... } } и заворачивает сетевые/контрактные
// сбои в ApiError с клиентскими кодами NETWORK / CONTRACT_VIOLATION
// (docs/api-contract.md §6).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequestCreated } from '../contract'
import { isApiError } from './errors'
import { httpApi, REQUEST_TIMEOUT_MS } from './http'

const REQUEST_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'a'.repeat(22)

function fakeResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

/** Ответ, тело которого не разбирается как JSON — как отдал бы прокси HTML. */
function brokenJsonResponse(status: number, ok = status >= 200 && status < 300) {
  return {
    ok,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0')
    },
  }
}

function validClientRequestBody(extra: Record<string, unknown> = {}) {
  return {
    number: '2609-001',
    status: 'qualified',
    createdAt: '2026-09-15T10:00:00.000Z',
    phoneConfirmedAt: '2026-09-15T10:05:00.000Z',
    routedAt: null,
    details: { category: 'kitchen', shape: 'corner', appliances: 'yes' },
    mainSize: { known: true, meters: 12.5 },
    description: 'Нужна угловая кухня на заказ',
    city: { code: 'almaty', name: null },
    district: null,
    finishLevel: null,
    readiness: null,
    photos: [],
    quotes: [],
    ...extra,
  }
}

function validCreatedBody() {
  return {
    id: REQUEST_ID,
    number: '2609-001',
    status: 'unconfirmed',
    createdAt: '2026-09-15T10:00:00.000Z',
    otp: { channel: 'sms', codeLength: 4, retryAfterSec: 0 },
  }
}

function createPayload() {
  return {
    details: { category: 'kitchen', shape: 'corner', appliances: 'yes' },
    mainSize: { known: true, meters: 12.5 },
    description: 'Нужна угловая кухня на заказ',
    city: { code: 'almaty', name: null },
    phone: '+77012345678',
    consent: { policyVersion: '2026-09-16', acceptedAt: '2026-09-16T10:00:00.000Z' },
    clientRequestId: REQUEST_ID,
  }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createRequest', () => {
  it('201 с валидным телом → RequestCreated, POST на /api/requests', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(201, validCreatedBody()))

    const result = await httpApi.createRequest(createPayload())

    expect(RequestCreated.parse(result)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('/api/requests')
    expect(options?.method).toBe('POST')
  })
})

describe('resendOtp', () => {
  it("POST на /api/requests/{id}/otp/resend", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { channel: 'sms', codeLength: 4, retryAfterSec: 30 }),
    )

    await httpApi.resendOtp({ requestId: REQUEST_ID })

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/api/requests/${REQUEST_ID}/otp/resend`)
    expect(options?.method).toBe('POST')
  })
})

describe('confirmOtp', () => {
  it("POST на /api/requests/{id}/otp/confirm", async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        request: {
          number: '2609-001',
          status: 'qualified',
          createdAt: '2026-09-15T10:00:00.000Z',
          phoneConfirmedAt: '2026-09-15T10:05:00.000Z',
          routedAt: null,
          details: { category: 'kitchen', shape: 'corner', appliances: 'yes' },
          mainSize: { known: true, meters: 12.5 },
          description: 'Нужна угловая кухня на заказ',
          city: { code: 'almaty', name: null },
          district: null,
          finishLevel: null,
          readiness: null,
          photos: [],
          quotes: [],
        },
        token: TOKEN,
      }),
    )

    await httpApi.confirmOtp({ requestId: REQUEST_ID, code: '1234' })

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/api/requests/${REQUEST_ID}/otp/confirm`)
    expect(options?.method).toBe('POST')
  })
})

describe('getRequestByToken', () => {
  it('GET на /api/client/requests/{token}', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        number: '2609-001',
        status: 'qualified',
        createdAt: '2026-09-15T10:00:00.000Z',
        phoneConfirmedAt: '2026-09-15T10:05:00.000Z',
        routedAt: null,
        details: { category: 'kitchen', shape: 'corner', appliances: 'yes' },
        mainSize: { known: true, meters: 12.5 },
        description: 'Нужна угловая кухня на заказ',
        city: { code: 'almaty', name: null },
        district: null,
        finishLevel: null,
        readiness: null,
        photos: [],
        quotes: [],
      }),
    )

    await httpApi.getRequestByToken(TOKEN)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit | undefined]
    expect(String(url)).toContain(`/api/client/requests/${TOKEN}`)
    expect(options?.method ?? 'GET').toBe('GET')
  })
})

describe('обработка ошибок', () => {
  it('4xx с конвертом OTP_RESEND_TOO_SOON → ApiError с тем же code и retryAfterSec', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(429, {
        error: { code: 'OTP_RESEND_TOO_SOON', message: 'подождите', retryAfterSec: 30 },
      }),
    )

    await expect(httpApi.resendOtp({ requestId: REQUEST_ID })).rejects.toSatisfy(
      (error: unknown) =>
        isApiError(error) &&
        error.code === 'OTP_RESEND_TOO_SOON' &&
        (error.details as { retryAfterSec: number } | undefined)?.retryAfterSec === 30,
    )
  })

  it('200 без обязательного поля number → ApiError CONTRACT_VIOLATION', async () => {
    const { number: _number, ...bodyWithoutNumber } = validCreatedBody()
    fetchMock.mockResolvedValueOnce(fakeResponse(200, bodyWithoutNumber))

    await expect(httpApi.createRequest(createPayload())).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'CONTRACT_VIOLATION',
    )
  })

  it('fetch отклонён (сеть упала) → ApiError NETWORK', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('сеть недоступна'))

    await expect(httpApi.createRequest(createPayload())).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'NETWORK',
    )
  })

  it('500 с конвертом INTERNAL → ApiError INTERNAL', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(500, { error: { code: 'INTERNAL', message: 'сервер упал' } }),
    )

    await expect(httpApi.createRequest(createPayload())).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'INTERNAL',
    )
  })
})

describe('форма тела запроса', () => {
  it('confirmOtp шлёт ровно { code } — requestId уходит в путь (§5)', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { request: validClientRequestBody(), token: TOKEN }),
    )

    await httpApi.confirmOtp({ requestId: REQUEST_ID, code: '1234' })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(options.body))).toEqual({ code: '1234' })
  })

  it('resendOtp шлёт пустое тело — requestId только в пути (§5)', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { channel: 'sms', codeLength: 4, retryAfterSec: 30 }),
    )

    await httpApi.resendOtp({ requestId: REQUEST_ID })

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(options.body).toBeUndefined()
  })
})

describe('страж стыковки', () => {
  it('4xx с телом не по форме конверта → CONTRACT_VIOLATION, а не молчаливый разбор', async () => {
    // Классика: перед приложением стоит прокси и отдаёт свою ошибку.
    fetchMock.mockResolvedValueOnce(
      fakeResponse(502, { message: 'Bad Gateway', detail: 'upstream timeout' }),
    )

    await expect(httpApi.createRequest(createPayload())).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'CONTRACT_VIOLATION',
    )
  })

  it('битый JSON в успешном ответе → CONTRACT_VIOLATION', async () => {
    fetchMock.mockResolvedValueOnce(brokenJsonResponse(200))

    await expect(httpApi.createRequest(createPayload())).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'CONTRACT_VIOLATION',
    )
  })

  it('битый JSON в ответе с ошибкой → CONTRACT_VIOLATION, а не выдуманный код', async () => {
    fetchMock.mockResolvedValueOnce(brokenJsonResponse(500))

    await expect(httpApi.createRequest(createPayload())).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'CONTRACT_VIOLATION',
    )
  })

  it('200 с ЛИШНИМ полем phone внутри RequestForClient → CONTRACT_VIOLATION', async () => {
    // На strictObject держится обещание §7: телефона в клиентской проекции
    // нет ни в каком виде. Утечка ПДн обязана падать как ошибка стыковки,
    // а не проходить молча, отбросив лишнее поле.
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, validClientRequestBody({ phone: '+77012345678' })),
    )

    await expect(httpApi.getRequestByToken(TOKEN)).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'CONTRACT_VIOLATION',
    )
  })

  it('лишний phone внутри confirmOtp.request — тот же отказ', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        request: validClientRequestBody({ phone: '+77012345678' }),
        token: TOKEN,
      }),
    )

    await expect(
      httpApi.confirmOtp({ requestId: REQUEST_ID, code: '1234' }),
    ).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'CONTRACT_VIOLATION',
    )
  })
})

describe('таймаут', () => {
  it('зависший запрос становится NETWORK, а не висит вечно (§6)', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          }),
      )

      const pending = httpApi.createRequest(createPayload())
      const assertion = expect(pending).rejects.toSatisfy(
        (error: unknown) => isApiError(error) && error.code === 'NETWORK',
      )

      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })

  it('уложившийся в таймаут запрос свой таймер снимает', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockResolvedValueOnce(fakeResponse(201, validCreatedBody()))

      await httpApi.createRequest(createPayload())

      // Ни одного висящего таймера: иначе процесс держал бы их пачками.
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * US-10. Две вещи, которые ломаются молча и которые поэтому проверяются:
 * Content-Type у multipart не выставляется руками (иначе сервер не найдёт
 * boundary), и снятый снимок уходит методом DELETE, а не остаётся висеть.
 */
describe('uploadPhoto и deletePhoto — US-10', () => {
  const PHOTO = {
    id: '3f1b8a2e-8c4d-4a6b-9f2e-1a2b3c4d5e6f',
    url: 'https://cdn.example.kz/3f1b8a2e.jpg',
    name: 'kitchen.jpg',
    bytes: 1024,
    mime: 'image/jpeg',
  }

  function jpeg(): File {
    return new File([new Blob([new Uint8Array(1024)])], 'kitchen.jpg', { type: 'image/jpeg' })
  }

  it('POST на /api/photos с multipart-телом', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, PHOTO))

    const photo = await httpApi.uploadPhoto(jpeg())

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('/api/photos')
    expect(options?.method).toBe('POST')
    expect(options?.body).toBeInstanceOf(FormData)
    expect(photo.name).toBe('kitchen.jpg')
  })

  it('Content-Type руками НЕ выставляется — его ставит браузер вместе с boundary', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, PHOTO))

    await httpApi.uploadPhoto(jpeg())

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = (options?.headers ?? {}) as Record<string, string>
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('content-type')
  })

  it('ответ не по контракту — CONTRACT_VIOLATION, а не молчаливый проглот', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { ...PHOTO, mime: 'application/pdf' }))

    await expect(httpApi.uploadPhoto(jpeg()))
      .rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'CONTRACT_VIOLATION')
  })

  it('DELETE на /api/photos/{id}; пустое тело ответа не роняет разбор', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(204, undefined))

    await httpApi.deletePhoto(PHOTO.id)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/api/photos/${PHOTO.id}`)
    expect(options?.method).toBe('DELETE')
  })
})

describe('кабинет мебельщика (§5б)', () => {
  const MASTER_ID = 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  const MASTER_TOKEN = 'b'.repeat(32)

  const sessionBody = () => ({
    master: { id: MASTER_ID, name: 'Мастерская на Сайране', city: { code: 'almaty', name: null } },
    token: MASTER_TOKEN,
  })

  const listItemBody = () => ({
    id: REQUEST_ID,
    number: '2609-001',
    routedAt: '2026-09-16T10:00:00.000Z',
    category: 'kitchen',
    mainSize: { known: true, meters: 3.2 },
    city: { code: 'almaty', name: null },
    district: null,
    photosCount: 0,
    readiness: null,
    quotedByMe: false,
  })

  const quoteBody = () => ({
    id: '3f1b8a2e-8c4d-4a6b-9f2e-1a2b3c4d5e01',
    requestId: REQUEST_ID,
    master: { id: MASTER_ID, name: 'Мастерская на Сайране', phone: '+77010000001' },
    composition: {
      items: ['bodies', 'doors', 'countertop'],
      excluded: 'Замер оплачивается отдельно',
    },
    price: { minKzt: 900_000, maxKzt: 1_400_000 },
    leadTimeDays: 30,
    photos: [],
    sentAt: '2026-09-16T12:00:00.000Z',
    updatedAt: null,
  })

  function headersOf(call: number): Record<string, string> {
    const [, options] = fetchMock.mock.calls[call] as [string, RequestInit]
    return (options?.headers ?? {}) as Record<string, string>
  }

  it('запрос кода: POST на /api/master/otp/request', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { channel: 'sms', codeLength: 4, retryAfterSec: 0 }),
    )

    await httpApi.masterRequestCode({ phone: '+77010000001' })

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('/api/master/otp/request')
    expect(options?.method).toBe('POST')
  })

  it('подтверждение кода отдаёт сессию по контракту', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, sessionBody()))

    const session = await httpApi.masterConfirmCode({ phone: '+77010000001', code: '1234' })

    expect(session.token).toBe(MASTER_TOKEN)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/master/otp/confirm')
  })

  it('токен уходит заголовком Authorization, а не в URL', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, [listItemBody()]))

    await httpApi.listRequestsForMaster(MASTER_TOKEN)

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe('/api/master/requests')
    expect(String(url)).not.toContain(MASTER_TOKEN)
    expect(headersOf(0).Authorization).toBe(`Bearer ${MASTER_TOKEN}`)
  })

  it('список разбирается массивом проекций', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, [listItemBody()]))

    const list = await httpApi.listRequestsForMaster(MASTER_TOKEN)

    expect(list).toHaveLength(1)
    expect(list[0].number).toBe('2609-001')
  })

  it('телефон, протёкший в список, ловится как CONTRACT_VIOLATION', async () => {
    const leaked = { ...listItemBody(), clientPhone: '+77012345678' }
    fetchMock.mockResolvedValueOnce(fakeResponse(200, [leaked]))

    await expect(httpApi.listRequestsForMaster(MASTER_TOKEN)).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'CONTRACT_VIOLATION',
    )
  })

  it('чужая заявка: конверт NOT_ROUTED_TO_YOU доходит до вызывающего', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(403, { error: { code: 'NOT_ROUTED_TO_YOU', message: 'Эта заявка не ваша' } }),
    )

    await expect(httpApi.getRequestForMaster(MASTER_TOKEN, REQUEST_ID)).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'NOT_ROUTED_TO_YOU',
    )
  })

  it('протухшая сессия: MASTER_UNAUTHORIZED, а не CONTRACT_VIOLATION', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(401, { error: { code: 'MASTER_UNAUTHORIZED', message: 'Нужно войти заново' } }),
    )

    await expect(httpApi.listRequestsForMaster(MASTER_TOKEN)).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'MASTER_UNAUTHORIZED',
    )
  })

  it('КП уходит POST на /api/master/requests/{id}/quote с токеном в заголовке', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(201, quoteBody()))

    const quote = await httpApi.createQuote(MASTER_TOKEN, REQUEST_ID, {
      composition: {
        items: ['bodies', 'doors', 'countertop'],
        excluded: 'Замер оплачивается отдельно',
      },
      price: { minKzt: 900_000, maxKzt: 1_400_000 },
      leadTimeDays: 30,
    })

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe(`/api/master/requests/${REQUEST_ID}/quote`)
    expect(options?.method).toBe('POST')
    expect(headersOf(0).Authorization).toBe(`Bearer ${MASTER_TOKEN}`)
    expect(quote.price.maxKzt).toBe(1_400_000)
  })

  it('перевёрнутая вилка не уходит на сервер вовсе', async () => {
    await expect(
      httpApi.createQuote(MASTER_TOKEN, REQUEST_ID, {
        composition: { items: ['bodies'], excluded: 'Всё остальное отдельно' },
        price: { minKzt: 1_400_000, maxKzt: 900_000 },
        leadTimeDays: 30,
      }),
    ).rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'VALIDATION_FAILED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('своя карточка читается GET на /api/master/card с токеном', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { name: 'Цех 12', city: { code: 'almaty', name: null }, card: null }),
    )

    const mine = await httpApi.getMyCard(MASTER_TOKEN)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe('/api/master/card')
    expect(options?.method).toBe('GET')
    expect(headersOf(0).Authorization).toBe(`Bearer ${MASTER_TOKEN}`)
    expect(mine.card).toBeNull()
  })

  it('правка карточки уходит PUT — вместе со снимками и часами', async () => {
    const card = {
      about: 'Кухни на заказ',
      yearsOnMarket: 15,
      does: ['кухни'],
      role: 'workshop',
      services: [{ id: 'measure', paid: false }],
      serviceArea: null,
      extras: [],
      photos: [{ url: '/work-1.jpg', kind: 'kitchen', caption: null, isRender: false }],
      logo: null,
      warrantyMonths: 24,
      leadTime: { min: 25, max: 35 },
      hours: { days: ['mon'], from: '10:00', to: '19:00' },
      contactPhone: '+77010000001',
      messengers: ['whatsapp'],
      publishedAt: '2026-09-01T00:00:00.000Z',
    }
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, { name: 'Цех 12', city: { code: 'almaty', name: null }, card }),
    )

    const { publishedAt, ...patch } = card
    expect(publishedAt).toBeDefined()
    await httpApi.updateMyCard(MASTER_TOKEN, patch)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe('/api/master/card')
    expect(options?.method).toBe('PUT')
    // Снимки с 18.09 в теле запроса: карточку заполняет мебельщик (§5б).
    expect(String(options?.body)).toContain('work-1.jpg')
    // Дата публикации по-прежнему не правится: она след согласия, и схема
    // входа её не знает — лишнее поле отсекается до отправки.
    expect(String(options?.body)).not.toContain('publishedAt')
  })

  it('карточка каталога читается GET на /api/masters/{id}, без токена', async () => {
    fetchMock.mockResolvedValueOnce(
      fakeResponse(200, {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Цех 12',
        city: { code: 'almaty', name: null },
        card: {
          about: 'Кухни на заказ',
          yearsOnMarket: 15,
          does: ['кухни'],
          role: 'workshop',
          services: [{ id: 'measure', paid: false }],
          serviceArea: null,
          extras: [],
          photos: [{ url: '/work-1.jpg', kind: 'kitchen', caption: null, isRender: false }],
          logo: null,
          warrantyMonths: null,
          leadTime: null,
          hours: null,
          contactPhone: null,
          messengers: [],
          publishedAt: '2026-09-01T00:00:00.000Z',
        },
      }),
    )

    const card = await httpApi.getMasterCard('11111111-1111-4111-8111-111111111111')

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toBe('/api/masters/11111111-1111-4111-8111-111111111111')
    expect(options?.method).toBe('GET')
    expect(card.card.does).toEqual(['кухни'])
  })
})

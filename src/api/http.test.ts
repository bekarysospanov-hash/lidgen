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
    completedManually: false,
    details: { category: 'kitchen', shape: 'corner', appliances: 'yes' },
    mainSize: { known: true, meters: 12.5 },
    description: 'Нужна угловая кухня на заказ',
    city: { code: 'almaty', name: null },
    district: null,
    deadline: null,
    finishLevel: null,
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
          completedManually: false,
          details: { category: 'kitchen', shape: 'corner', appliances: 'yes' },
          mainSize: { known: true, meters: 12.5 },
          description: 'Нужна угловая кухня на заказ',
          city: { code: 'almaty', name: null },
          district: null,
          deadline: null,
          finishLevel: null,
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
        completedManually: false,
        details: { category: 'kitchen', shape: 'corner', appliances: 'yes' },
        mainSize: { known: true, meters: 12.5 },
        description: 'Нужна угловая кухня на заказ',
        city: { code: 'almaty', name: null },
        district: null,
        deadline: null,
        finishLevel: null,
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

// Тесты мока (src/api/mocks). Красные до реализации — мок обязан реализовать
// контракт целиком, включая ошибки и пустые состояния (CLAUDE.md,
// docs/api-contract.md §10). reset() из store даёт изоляцию между тестами.
import { beforeEach, describe, expect, it } from 'vitest'
import {
  PHOTO_MAX_BYTES,
  Photo,
  OtpSent,
  RequestConfirmed,
  RequestCreated,
  RequestForClient,
  RequestId,
  RequestNumber,
  Token,
} from '../../contract'
import { ApiError, isApiError } from '../errors'
import { mockApi } from './index'
import { getRequestRecord, listEvents, reset } from './store'

const VALID_CODE = '1234'
const INVALID_CODE = '9999'

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    details: { category: 'kitchen', shape: 'corner', appliances: 'yes' },
    mainSize: { known: true, meters: 12.5 },
    description: 'Нужна угловая кухня на заказ, с встроенной техникой',
    city: { code: 'almaty', name: null },
    phone: '+77012345678',
    consent: { policyVersion: '2026-09-16', acceptedAt: '2026-09-16T10:00:00.000Z' },
    clientRequestId: '11111111-1111-4111-8111-111111111111',
    ...overrides,
  }
}

async function createAndConfirm(overrides: Record<string, unknown> = {}) {
  const created = await mockApi.createRequest(createPayload(overrides))
  const confirmed = await mockApi.confirmOtp({ requestId: created.id, code: VALID_CODE })
  return { created, confirmed }
}

beforeEach(() => {
  reset()
})

describe('createRequest', () => {
  it('создаёт заявку в статусе unconfirmed с присвоенным number/id/otp', async () => {
    const result = await mockApi.createRequest(createPayload())

    expect(result.status).toBe('unconfirmed')
    expect(RequestNumber.safeParse(result.number).success).toBe(true)
    expect(RequestId.safeParse(result.id).success).toBe(true)
    expect(result.otp.codeLength).toBe(4)
    expect(RequestCreated.parse(result)).toBeTruthy()
  })

  it('без согласия на ПДн заявка не создаётся (US-11)', async () => {
    const { consent, ...withoutConsent } = createPayload() as Record<string, unknown>
    expect(consent).toBeDefined()

    await expect(mockApi.createRequest(withoutConsent)).rejects.toSatisfy(
      (e: unknown) =>
        isApiError(e) &&
        e.code === 'VALIDATION_FAILED' &&
        JSON.stringify(e.details).includes('consent'),
    )
  })

  it('token в ответе createRequest отсутствует — выдаётся только в confirmOtp', async () => {
    const result = await mockApi.createRequest(createPayload())
    expect('token' in result).toBe(false)
  })

  it('пишет события request_submitted и otp_requested', async () => {
    const result = await mockApi.createRequest(createPayload())
    const events = listEvents().filter((event) => event.requestId === result.id)

    expect(events.some((event) => event.type === 'request_submitted')).toBe(true)
    expect(events.some((event) => event.type === 'otp_requested')).toBe(true)
  })

  it('повтор с тем же clientRequestId возвращает ту же заявку, без дубля', async () => {
    const first = await mockApi.createRequest(createPayload())
    const second = await mockApi.createRequest(createPayload())

    expect(second.id).toBe(first.id)
    expect(second.number).toBe(first.number)

    const submitted = listEvents().filter((event) => event.type === 'request_submitted')
    const requested = listEvents().filter((event) => event.type === 'otp_requested')
    expect(submitted).toHaveLength(1)
    expect(requested).toHaveLength(1)
  })
})

describe('confirmOtp', () => {
  it('неверный код бросает ApiError OTP_INVALID, статус не меняется', async () => {
    const created = await mockApi.createRequest(createPayload())

    await expect(
      mockApi.confirmOtp({ requestId: created.id, code: INVALID_CODE }),
    ).rejects.toSatisfy((error: unknown) => isApiError(error) && error.code === 'OTP_INVALID')

    // Заявка всё ещё не подтверждена: повторный неверный код снова OTP_INVALID,
    // а не ALREADY_CONFIRMED — значит статус не сдвинулся.
    await expect(
      mockApi.confirmOtp({ requestId: created.id, code: INVALID_CODE }),
    ).rejects.toSatisfy((error: unknown) => isApiError(error) && error.code === 'OTP_INVALID')
  })

  it('лимита попыток нет: после пяти неверных верный код проходит', async () => {
    const created = await mockApi.createRequest(createPayload())

    for (let i = 0; i < 5; i += 1) {
      await expect(
        mockApi.confirmOtp({ requestId: created.id, code: INVALID_CODE }),
      ).rejects.toBeInstanceOf(ApiError)
    }

    const confirmed = await mockApi.confirmOtp({ requestId: created.id, code: VALID_CODE })
    expect(RequestConfirmed.parse(confirmed)).toBeTruthy()
  })

  it('верный код, almaty + mainSize.known → routed (маршрутизация синхронна), token выдан, событие otp_confirmed', async () => {
    const { created, confirmed } = await createAndConfirm()

    // qualified живёт ровно один шаг: мок маршрутизирует тем же вызовом,
    // потому что сервера с отдельным шагом рассылки у пробы нет (§4, §10).
    expect(confirmed.request.status).toBe('routed')
    expect(confirmed.request.routedAt).not.toBeNull()
    expect(confirmed.request.phoneConfirmedAt).not.toBeNull()
    expect(Token.safeParse(confirmed.token).success).toBe(true)

    const events = listEvents().filter((event) => event.requestId === created.id)
    expect(events.some((event) => event.type === 'otp_confirmed')).toBe(true)
  })

  it('mainSize.known:false, almaty → incomplete', async () => {
    const { confirmed } = await createAndConfirm({ mainSize: { known: false } })
    expect(confirmed.request.status).toBe('incomplete')
  })

  it("city.code:'other' и mainSize.known:false → out_of_coverage (приоритет над incomplete)", async () => {
    const { confirmed } = await createAndConfirm({
      city: { code: 'other', name: 'Талдыкорган' },
      mainSize: { known: false },
    })
    expect(confirmed.request.status).toBe('out_of_coverage')
  })

  it('идемпотентность верного кода: повтор возвращает тот же token/request', async () => {
    const { created } = await createAndConfirm()
    const first = await mockApi.confirmOtp({ requestId: created.id, code: VALID_CODE })
    const second = await mockApi.confirmOtp({ requestId: created.id, code: VALID_CODE })

    expect(second.token).toBe(first.token)
    expect(second.request).toEqual(first.request)

    const confirmedEvents = listEvents().filter(
      (event) => event.requestId === created.id && event.type === 'otp_confirmed',
    )
    expect(confirmedEvents).toHaveLength(1)
  })

  it('неверный код на уже подтверждённой заявке → ALREADY_CONFIRMED', async () => {
    const { created } = await createAndConfirm()

    await expect(
      mockApi.confirmOtp({ requestId: created.id, code: INVALID_CODE }),
    ).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'ALREADY_CONFIRMED',
    )
  })

  it('неизвестный requestId → REQUEST_NOT_FOUND', async () => {
    await expect(
      mockApi.confirmOtp({
        requestId: '99999999-9999-4999-8999-999999999999',
        code: VALID_CODE,
      }),
    ).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'REQUEST_NOT_FOUND',
    )
  })
})

describe('resendOtp', () => {
  it('сразу после createRequest → OTP_RESEND_TOO_SOON с retryAfterSec > 0', async () => {
    const created = await mockApi.createRequest(createPayload())

    try {
      await mockApi.resendOtp({ requestId: created.id })
      expect.unreachable('resendOtp должен был отклонить кулдауном')
    } catch (error) {
      expect(isApiError(error)).toBe(true)
      if (isApiError(error)) {
        expect(error.code).toBe('OTP_RESEND_TOO_SOON')
        expect(error.details && 'retryAfterSec' in error.details).toBe(true)
        expect((error.details as { retryAfterSec: number }).retryAfterSec).toBeGreaterThan(0)
      }
    }
  })

  it('после подтверждения → ALREADY_CONFIRMED', async () => {
    const { created } = await createAndConfirm()

    await expect(mockApi.resendOtp({ requestId: created.id })).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'ALREADY_CONFIRMED',
    )
  })

  it('по истечении кулдауна: двигает otpSentAt, пишет otp_requested, отдаёт OtpSent', async () => {
    const created = await mockApi.createRequest(createPayload())

    // Кулдаун отматывается назад через запись мока: ждать 30 секунд
    // в тесте нечего, а проверяем мы поведение resendOtp, не часы.
    const record = getRequestRecord(created.id)!
    const before = new Date(Date.now() - 60_000).toISOString()
    record.otpSentAt = before

    const sent = await mockApi.resendOtp({ requestId: created.id })

    expect(OtpSent.parse(sent)).toBeTruthy()
    expect(sent.codeLength).toBe(4)
    // Новый код только что ушёл — значит следующий повтор снова под кулдауном.
    expect(sent.retryAfterSec).toBeGreaterThan(0)

    const after = getRequestRecord(created.id)?.otpSentAt
    expect(after).not.toBe(before)
    expect(new Date(after!).getTime()).toBeGreaterThan(new Date(before).getTime())

    const requested = listEvents().filter(
      (event) => event.requestId === created.id && event.type === 'otp_requested',
    )
    expect(requested).toHaveLength(2)
    expect(requested[1]?.payload).toMatchObject({ resend: true })
  })

  it('неизвестный requestId → REQUEST_NOT_FOUND', async () => {
    await expect(
      mockApi.resendOtp({ requestId: '99999999-9999-4999-8999-999999999999' }),
    ).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'REQUEST_NOT_FOUND',
    )
  })
})

describe('getRequestByToken', () => {
  it('неизвестный токен → TOKEN_INVALID', async () => {
    await expect(mockApi.getRequestByToken('z'.repeat(22))).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'TOKEN_INVALID',
    )
  })

  it('валидный токен: ответ без phone и без id, quotes пуст, пишет client_page_opened', async () => {
    const { created, confirmed } = await createAndConfirm()
    const result = await mockApi.getRequestByToken(confirmed.token)

    expect('phone' in result).toBe(false)
    expect('id' in result).toBe(false)
    expect(result.quotes).toEqual([])
    expect(RequestForClient.parse(result)).toBeTruthy()

    const opened = listEvents().filter(
      (event) => event.requestId === created.id && event.type === 'client_page_opened',
    )
    expect(opened).toHaveLength(1)
    expect(opened[0]?.payload).toMatchObject({ quotesCount: 0 })
  })

  it('повторное открытие не меняет clientFirstOpenedAt внутреннего состояния заявки', async () => {
    const { created, confirmed } = await createAndConfirm()

    await mockApi.getRequestByToken(confirmed.token)
    const firstRecord = getRequestRecord(created.id)
    const firstOpenedAt = firstRecord?.clientFirstOpenedAt ?? null
    expect(firstOpenedAt).not.toBeNull()

    await mockApi.getRequestByToken(confirmed.token)
    const secondRecord = getRequestRecord(created.id)

    expect(secondRecord?.clientFirstOpenedAt).toBe(firstOpenedAt)
  })

  it('заявка в статусе unconfirmed недостижима по токену — токена ей ещё не выдали', async () => {
    const created = await mockApi.createRequest(createPayload())
    expect(created.status).toBe('unconfirmed')

    // В самой записи токена нет: выдать его может только confirmOtp (§3).
    expect(getRequestRecord(created.id)?.token).toBeNull()

    // И синтаксически безупречная строка токена к ней всё равно не ведёт:
    // недостижимость держится на отсутствии записи, а не на форме строки.
    const wellFormed = 'A'.repeat(32)
    expect(Token.safeParse(wellFormed).success).toBe(true)
    await expect(mockApi.getRequestByToken(wellFormed)).rejects.toSatisfy(
      (error: unknown) => isApiError(error) && error.code === 'TOKEN_INVALID',
    )

    // Открытия клиентской страницы по этой заявке не записано — значит
    // ни один из вызовов до неё не дотянулся.
    expect(
      listEvents().filter(
        (event) => event.requestId === created.id && event.type === 'client_page_opened',
      ),
    ).toHaveLength(0)
  })

  it('токен одной заявки не открывает другую', async () => {
    const other = await mockApi.createRequest(createPayload())
    const { created, confirmed } = await createAndConfirm({
      clientRequestId: '22222222-2222-4222-8222-222222222222',
      description: 'Вторая заявка, подтверждённая',
    })

    const opened = await mockApi.getRequestByToken(confirmed.token)

    expect(opened.number).toBe(getRequestRecord(created.id)?.number)
    expect(opened.number).not.toBe(getRequestRecord(other.id)?.number)
  })
})

describe('валидация payload на входе', () => {
  it('невалидный телефон → VALIDATION_FAILED с путём phone в details.fields', async () => {
    await expect(
      mockApi.createRequest(createPayload({ phone: '87012345678' })),
    ).rejects.toSatisfy((error: unknown) => {
      if (!isApiError(error) || error.code !== 'VALIDATION_FAILED') return false
      const fields = (error.details as { fields?: { path: string }[] } | undefined)?.fields
      return Array.isArray(fields) && fields.some((field) => field.path === 'phone')
    })
  })

  it("city.code:'other' без названия → VALIDATION_FAILED с путём city.name", async () => {
    await expect(
      mockApi.createRequest(createPayload({ city: { code: 'other', name: null } })),
    ).rejects.toSatisfy((error: unknown) => {
      if (!isApiError(error) || error.code !== 'VALIDATION_FAILED') return false
      const fields = (error.details as { fields?: { path: string }[] } | undefined)?.fields
      return Array.isArray(fields) && fields.some((field) => field.path === 'city.name')
    })
  })

  it('метры с тремя знаками после запятой отвергаются — точность, а не диапазон', async () => {
    await expect(
      mockApi.createRequest(createPayload({ mainSize: { known: true, meters: 3.456 } })),
    ).rejects.toSatisfy((error: unknown) => {
      if (!isApiError(error) || error.code !== 'VALIDATION_FAILED') return false
      const fields = (error.details as { fields?: { path: string }[] } | undefined)?.fields
      return Array.isArray(fields) && fields.some((field) => field.path.startsWith('mainSize'))
    })
  })

  it('отвергнутый payload не создаёт ни записи, ни событий', async () => {
    await expect(
      mockApi.createRequest(createPayload({ description: '' })),
    ).rejects.toBeInstanceOf(ApiError)

    expect(listEvents()).toHaveLength(0)
  })
})

describe('роли в событиях воронки', () => {
  it('заказчица порождает request_submitted, otp_confirmed и client_page_opened', async () => {
    const { created, confirmed } = await createAndConfirm()
    await mockApi.getRequestByToken(confirmed.token)

    const roleOf = (type: string) =>
      listEvents().find((event) => event.requestId === created.id && event.type === type)?.actor.role

    expect(roleOf('request_submitted')).toBe('client')
    expect(roleOf('otp_confirmed')).toBe('client')
    expect(roleOf('client_page_opened')).toBe('client')
  })

  it('автоматическая рассылка кода при создании — system, а повторная по кнопке — client', async () => {
    const created = await mockApi.createRequest(createPayload())

    const first = listEvents().find((event) => event.type === 'otp_requested')
    expect(first?.actor.role).toBe('system')

    // Кулдаун сдвигается в прошлое: проверяем роль повторной отправки,
    // а не таймер — сам кулдаун проверен отдельным тестом.
    const record = getRequestRecord(created.id)!
    record.otpSentAt = new Date(Date.now() - 60_000).toISOString()

    await mockApi.resendOtp({ requestId: created.id })

    const resent = listEvents().filter((event) => event.type === 'otp_requested')
    expect(resent).toHaveLength(2)
    expect(resent[1]?.actor.role).toBe('client')
  })
})

/**
 * US-10 — загрузка снимков. Мок обязан отказывать так же, как сервер:
 * иначе экран никогда не встретит своего состояния ошибки, и на стыковке
 * выяснится, что показывать нечего.
 */
describe('uploadPhoto — US-10', () => {
  beforeEach(() => {
    // blob:-адресов в node нет; подменяем ровно то, чего не хватает.
    globalThis.URL.createObjectURL = () => 'blob:test'
    globalThis.URL.revokeObjectURL = () => {}
  })

  function file(name: string, type: string, size: number): File {
    const blob = new Blob([new Uint8Array(size)], { type })
    return new File([blob], name, { type })
  }

  it('снимок принимается и возвращается по контракту', async () => {
    const photo = await mockApi.uploadPhoto(file('kitchen.jpg', 'image/jpeg', 1024))
    expect(Photo.safeParse(photo).success).toBe(true)
    expect(photo.name).toBe('kitchen.jpg')
  })

  it('pdf отклоняется кодом контракта, а не молча', async () => {
    await expect(mockApi.uploadPhoto(file('smeta.pdf', 'application/pdf', 1024)))
      .rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'VALIDATION_FAILED')
  })

  it('файл больше лимита отклоняется', async () => {
    const big = file('huge.jpg', 'image/jpeg', PHOTO_MAX_BYTES + 1)
    await expect(mockApi.uploadPhoto(big))
      .rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'VALIDATION_FAILED')
  })

  it('заявка с снимками сохраняет их в проекции клиента', async () => {
    const photo = await mockApi.uploadPhoto(file('kitchen.jpg', 'image/jpeg', 1024))
    const created = await mockApi.createRequest(createPayload({ photos: [photo] }))
    const { token } = await mockApi.confirmOtp({ requestId: created.id, code: VALID_CODE })
    const seen = await mockApi.getRequestByToken(token)
    expect(seen.photos).toHaveLength(1)
    expect(seen.photos[0].name).toBe('kitchen.jpg')
  })

  it('заявка без снимков законна — отправку они не блокируют', async () => {
    const created = await mockApi.createRequest(createPayload())
    const { token } = await mockApi.confirmOtp({ requestId: created.id, code: VALID_CODE })
    expect((await mockApi.getRequestByToken(token)).photos).toEqual([])
  })
})

describe('события воронки (US-25a)', () => {
  const funnelEvent = (type: string, overrides: Record<string, unknown> = {}) => ({
    type,
    requestId: null,
    actor: { role: 'client' },
    sessionId: 'sess-1',
    ...overrides,
  })

  it('пачка событий попадает в тот же журнал, что и серверные', async () => {
    await mockApi.sendEvents({
      events: [funnelEvent('visit'), funnelEvent('category_selected', { payload: { category: 'kitchen' } })],
    })

    const types = listEvents().map((event) => event.type)
    expect(types).toContain('visit')
    expect(types).toContain('category_selected')
  })

  it('время ставит сервер: at приходит от него, а не от клиента', async () => {
    await mockApi.sendEvents({ events: [funnelEvent('visit', { at: '1999-01-01T00:00:00.000Z' })] })

    const visit = listEvents().find((event) => event.type === 'visit')!
    expect(visit.at.startsWith('1999')).toBe(false)
  })

  it('событие воронки без sessionId не принимается — его не с чем связать', async () => {
    const { sessionId, ...withoutSession } = funnelEvent('visit')
    expect(sessionId).toBeDefined()

    await expect(mockApi.sendEvents({ events: [withoutSession] })).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'VALIDATION_FAILED',
    )
  })

  it('пустая пачка не принимается', async () => {
    await expect(mockApi.sendEvents({ events: [] })).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'VALIDATION_FAILED',
    )
  })
})

describe('потерянная ссылка — US-21', () => {
  it('ответ одинаков, есть заявка по номеру или нет: иначе это перечисление', async () => {
    const known = await mockApi.resendLink({ phone: '+77012468024' })
    const unknown = await mockApi.resendLink({ phone: '+77019999999' })
    expect(known).toEqual(unknown)
  })

  it('канал и задержка повтора приходят всегда, а не только при отказе', async () => {
    const sent = await mockApi.resendLink({ phone: '+77019999999' })
    expect(sent.channel.length).toBeGreaterThan(0)
    expect(sent.retryAfterSec).toBeGreaterThanOrEqual(0)
  })

  it('номер не по формату отвергается до всякой отправки', async () => {
    await expect(mockApi.resendLink({ phone: '123' })).rejects.toSatisfy(
      (e: unknown) => isApiError(e) && e.code === 'VALIDATION_FAILED',
    )
  })

  it('событие пишется только когда ссылку действительно есть кому послать', async () => {
    const before = listEvents().filter((event) => event.type === 'link_resent').length
    await mockApi.resendLink({ phone: '+77019999999' })
    expect(listEvents().filter((event) => event.type === 'link_resent')).toHaveLength(before)
  })
})

describe('кабинет мебельщика — US-14, US-17, US-18, US-19a', () => {
  const ALMATY_PHONES = ['+77010000001', '+77010000002', '+77010000003']
  const ASTANA_PHONE = '+77010000004'

  async function login(phone: string) {
    await mockApi.masterRequestCode({ phone })
    return mockApi.masterConfirmCode({ phone, code: VALID_CODE })
  }

  const quotePayload = (overrides: Record<string, unknown> = {}) => ({
    composition: {
      items: ['bodies', 'doors', 'countertop'],
      excluded: 'Замер оплачивается отдельно',
    },
    price: { minKzt: 900_000, maxKzt: 1_400_000 },
    leadTimeDays: 30,
    ...overrides,
  })

  describe('вход по номеру и коду', () => {
    it('номера нет в списке мастерских → MASTER_NOT_FOUND', async () => {
      await expect(mockApi.masterRequestCode({ phone: '+77019999999' })).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'MASTER_NOT_FOUND',
      )
    })

    it('верный код выдаёт сессию с именем мастерской, но без телефона', async () => {
      const session = await login(ALMATY_PHONES[0])
      expect(Token.safeParse(session.token).success).toBe(true)
      expect(session.master.name).toBe('Мастерская на Сайране')
      expect('phone' in session.master).toBe(false)
    })

    it('неверный код не пускает', async () => {
      await mockApi.masterRequestCode({ phone: ALMATY_PHONES[0] })
      await expect(
        mockApi.masterConfirmCode({ phone: ALMATY_PHONES[0], code: INVALID_CODE }),
      ).rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'OTP_INVALID')
    })

    it('повторный запрос кода упирается в кулдаун — как и у заявки', async () => {
      await mockApi.masterRequestCode({ phone: ALMATY_PHONES[0] })
      await expect(mockApi.masterRequestCode({ phone: ALMATY_PHONES[0] })).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'OTP_RESEND_TOO_SOON',
      )
    })

    it('код нельзя подтвердить, если его не запрашивали', async () => {
      await expect(
        mockApi.masterConfirmCode({ phone: ALMATY_PHONES[0], code: VALID_CODE }),
      ).rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'OTP_INVALID')
    })

    it('reset уносит сессию: заявок прошлого прогона она не откроет', async () => {
      const { token } = await login(ALMATY_PHONES[0])
      reset()
      await expect(mockApi.listRequestsForMaster(token)).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'MASTER_UNAUTHORIZED',
      )
    })

    it('мусорный токен не открывает список', async () => {
      await expect(mockApi.listRequestsForMaster('нетакойтокен')).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'MASTER_UNAUTHORIZED',
      )
    })
  })

  describe('маршрутизация (US-14)', () => {
    it('пустой список законен: заявок ещё нет', async () => {
      const { token } = await login(ALMATY_PHONES[0])
      expect(await mockApi.listRequestsForMaster(token)).toEqual([])
    })

    it('заявка из Алматы уходит троим мебельщикам этого города', async () => {
      await createAndConfirm()

      for (const phone of ALMATY_PHONES) {
        const { token } = await login(phone)
        const list = await mockApi.listRequestsForMaster(token)
        expect(list).toHaveLength(1)
        expect(list[0].category).toBe('kitchen')
      }
    })

    it('мебельщику из другого города заявка не видна', async () => {
      await createAndConfirm()
      const { token } = await login(ASTANA_PHONE)
      expect(await mockApi.listRequestsForMaster(token)).toEqual([])
    })

    it('incomplete не маршрутизируется — сначала дозвон', async () => {
      const { confirmed } = await createAndConfirm({ mainSize: { known: false } })
      expect(confirmed.request.status).toBe('incomplete')
      expect(confirmed.request.routedAt).toBeNull()

      const { token } = await login(ALMATY_PHONES[0])
      expect(await mockApi.listRequestsForMaster(token)).toEqual([])
    })

    it('вне покрытия не маршрутизируется — передавать некому', async () => {
      const { confirmed } = await createAndConfirm({ city: { code: 'other', name: 'Талдыкорган' } })
      expect(confirmed.request.status).toBe('out_of_coverage')
      expect(confirmed.request.routedAt).toBeNull()
    })

    it('список отсортирован: новые первыми', async () => {
      await createAndConfirm()
      await createAndConfirm({ clientRequestId: '22222222-2222-4222-8222-222222222222' })

      const { token } = await login(ALMATY_PHONES[0])
      const list = await mockApi.listRequestsForMaster(token)
      expect(list).toHaveLength(2)
      expect(list[0].routedAt >= list[1].routedAt).toBe(true)
    })
  })

  describe('дополнение КП (US-19b)', () => {
    it('правка меняет цену, но остаётся тем же предложением', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])
      const first = await mockApi.createQuote(token, created.id, quotePayload())

      const revised = await mockApi.updateQuote(
        token,
        created.id,
        quotePayload({ price: { minKzt: 1_000_000, maxKzt: 1_500_000 } }),
      )

      expect(revised.id).toBe(first.id)
      expect(revised.sentAt).toBe(first.sentAt)
      expect(revised.updatedAt).not.toBeNull()
      expect(revised.price.minKzt).toBe(1_000_000)
    })

    it('у заказчицы остаётся одно предложение, а не два', async () => {
      const { created, confirmed } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])
      await mockApi.createQuote(token, created.id, quotePayload())
      await mockApi.updateQuote(token, created.id, quotePayload({ leadTimeDays: 45 }))

      const seen = await mockApi.getRequestByToken(confirmed.token)
      expect(seen.quotes).toHaveLength(1)
      expect(seen.quotes[0].leadTimeDays).toBe(45)
    })

    it('правка не пишет второе quote_sent — в метрике КП одно', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])
      await mockApi.createQuote(token, created.id, quotePayload())
      await mockApi.updateQuote(token, created.id, quotePayload({ leadTimeDays: 45 }))

      expect(listEvents().filter((event) => event.type === 'quote_sent')).toHaveLength(1)
    })

    it('править нечего, пока КП не отправлено', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])

      await expect(mockApi.updateQuote(token, created.id, quotePayload())).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'QUOTE_NOT_FOUND',
      )
    })

    it('чужое КП не правится', async () => {
      const { created } = await createAndConfirm()
      const first = await login(ALMATY_PHONES[0])
      const second = await login(ALMATY_PHONES[1])
      await mockApi.createQuote(first.token, created.id, quotePayload())

      await expect(
        mockApi.updateQuote(second.token, created.id, quotePayload()),
      ).rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'QUOTE_NOT_FOUND')
    })
  })
  describe('карточка заявки (US-18)', () => {
    it('несуществующая и чужая заявка отвечают одинаково', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ASTANA_PHONE)

      const missing = mockApi.getRequestForMaster(token, '3f1b8a2e-8c4d-4a6b-9f2e-1a2b3c4d5e99')
      const foreign = mockApi.getRequestForMaster(token, created.id)

      for (const call of [missing, foreign]) {
        await expect(call).rejects.toSatisfy(
          (e: unknown) => isApiError(e) && e.code === 'NOT_ROUTED_TO_YOU',
        )
      }
    })

    it('до отправки КП телефона заказчицы в карточке нет вовсе', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])

      const card = await mockApi.getRequestForMaster(token, created.id)
      expect(card.clientPhone).toBeNull()
      expect(card.myQuote).toBeNull()
      expect(card.description).toBeTruthy()
    })

    it('чужое КП в карточке не показывается — ни ценой, ни фактом', async () => {
      const { created } = await createAndConfirm()
      const first = await login(ALMATY_PHONES[0])
      const second = await login(ALMATY_PHONES[1])

      await mockApi.createQuote(first.token, created.id, quotePayload())
      const card = await mockApi.getRequestForMaster(second.token, created.id)

      expect(card.myQuote).toBeNull()
      expect(card.clientPhone).toBeNull()
      expect(JSON.stringify(card)).not.toContain('900000')
    })
  })

  describe('своя карточка и карточка каталога — US-20, US-03', () => {
    it('карточки, которой нет, не существует и для чтения каталога', async () => {
      // Мастерская из списка есть, карточки у неё нет — ответ тот же, что
      // для несуществующего id: приём заявок и публикация разные решения,
      // и подтверждать существование мастерской чужому человеку незачем.
      await expect(mockApi.getMasterCard('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1')).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'MASTER_NOT_FOUND',
      )
    })

    it('несуществующая мастерская отвечает так же', async () => {
      await expect(mockApi.getMasterCard('00000000-0000-4000-8000-000000000000')).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'MASTER_NOT_FOUND',
      )
    })

    it('мебельщик видит своё название и город, карточки пока нет', async () => {
      const session = await login(ALMATY_PHONES[0])
      const mine = await mockApi.getMyCard(session.token)
      expect(mine.name.length).toBeGreaterThan(0)
      expect(mine.card).toBeNull()
    })

    it('правка до публикации — CARD_NOT_PUBLISHED, а не ошибка ввода', async () => {
      const session = await login(ALMATY_PHONES[0])
      await expect(
        mockApi.updateMyCard(session.token, {
          about: 'Кухни на заказ',
          yearsOnMarket: 15,
          does: ['кухни'],
        }),
      ).rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'CARD_NOT_PUBLISHED')
    })

    it('чужой токен карточку не отдаёт', async () => {
      await expect(mockApi.getMyCard('не-токен')).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'MASTER_UNAUTHORIZED',
      )
    })
  })

  describe('отправка КП (US-19a)', () => {
    it('КП отправлено: телефон заказчицы открывается только теперь', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])

      const quote = await mockApi.createQuote(token, created.id, quotePayload())
      expect(quote.master.name).toBe('Мастерская на Сайране')

      const card = await mockApi.getRequestForMaster(token, created.id)
      expect(card.clientPhone).toBe('+77012345678')
      expect(card.myQuote?.id).toBe(quote.id)
    })

    it('заказчица получает телефон мастерской вместе с КП (US-24)', async () => {
      const { created, confirmed } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])
      await mockApi.createQuote(token, created.id, quotePayload())

      const seen = await mockApi.getRequestByToken(confirmed.token)
      expect(seen.quotes[0].master.phone).toBe(ALMATY_PHONES[0])
    })
    it('первое КП переводит заявку в quoted и видно заказчице по токену', async () => {
      const { created, confirmed } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])
      await mockApi.createQuote(token, created.id, quotePayload())

      const seen = await mockApi.getRequestByToken(confirmed.token)
      expect(seen.status).toBe('quoted')
      expect(seen.quotes).toHaveLength(1)
      expect(seen.quotes[0].price.minKzt).toBe(900_000)
    })

    it('второе КП по той же заявке не принимается', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])
      await mockApi.createQuote(token, created.id, quotePayload())

      await expect(mockApi.createQuote(token, created.id, quotePayload())).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'QUOTE_ALREADY_SENT',
      )
    })

    it('ответ второго мебельщика статус не двигает, но копится у заказчицы', async () => {
      const { created, confirmed } = await createAndConfirm()
      const first = await login(ALMATY_PHONES[0])
      const second = await login(ALMATY_PHONES[1])

      await mockApi.createQuote(first.token, created.id, quotePayload())
      await mockApi.createQuote(second.token, created.id, quotePayload())

      const seen = await mockApi.getRequestByToken(confirmed.token)
      expect(seen.status).toBe('quoted')
      expect(seen.quotes).toHaveLength(2)
    })

    it('КП без верхней границы вилки не принимается', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])

      await expect(
        mockApi.createQuote(token, created.id, quotePayload({ price: { minKzt: 900_000 } })),
      ).rejects.toSatisfy((e: unknown) => isApiError(e) && e.code === 'VALIDATION_FAILED')
    })

    it('в чужую заявку КП не отправить', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ASTANA_PHONE)

      await expect(mockApi.createQuote(token, created.id, quotePayload())).rejects.toSatisfy(
        (e: unknown) => isApiError(e) && e.code === 'NOT_ROUTED_TO_YOU',
      )
    })

    it('после ответа список помечает заявку как отвеченную', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])

      expect((await mockApi.listRequestsForMaster(token))[0].quotedByMe).toBe(false)
      await mockApi.createQuote(token, created.id, quotePayload())
      expect((await mockApi.listRequestsForMaster(token))[0].quotedByMe).toBe(true)
    })

    it('событие quote_sent записано от имени мебельщика', async () => {
      const { created } = await createAndConfirm()
      const { token } = await login(ALMATY_PHONES[0])
      await mockApi.createQuote(token, created.id, quotePayload())

      const sent = listEvents().filter((event) => event.type === 'quote_sent')
      expect(sent).toHaveLength(1)
      expect(sent[0].actor.role).toBe('master')
      expect(sent[0].requestId).toBe(created.id)
    })
  })
})

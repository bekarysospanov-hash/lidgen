// Тесты контракта (zod-схемы). Красные до реализации src/contract/index.ts —
// это ожидаемо: TDD, реализацию пишет следующий этап.
// Источник правды: docs/api-contract.md (11 разделов).
import { describe, expect, it } from 'vitest'
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  Photo,
  Photos,
  ApiErrorBody,
  CategoryId,
  City,
  CityCode,
  CreateRequest,
  Details,
  ErrorCode,
  ErrorEnvelope,
  Event,
  EventType,
  Iso,
  MainSize,
  OtpCode,
  OtpSent,
  Phone,
  Quote,
  RequestConfirmed,
  RequestCreated,
  RequestForClient,
  RequestId,
  RequestNumber,
  RequestStatus,
  ResendOtpInput,
  ConfirmOtpInput,
  Token,
  CreateQuote,
  Master,
  MasterProfile,
  RequestForMaster,
  RequestForMasterListItem,
  Routing,
} from './index'

// Валидный CreateRequest для кухни — кейсы ниже отличаются одним полем
// (api-contract.md §5, таблица CreateRequest).
function validCreateRequest(overrides: Record<string, unknown> = {}) {
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

describe('Phone', () => {
  it('+77012345678 — валидный номер РК', () => {
    expect(Phone.safeParse('+77012345678').success).toBe(true)
  })

  it.each([
    ['87012345678', 'без плюса'],
    ['+7701234567', '9 цифр после кода'],
    ['+771234567890', '11 цифр после кода'],
    ['abc', 'не число'],
    ['', 'пустая строка'],
  ])('%s отклоняется (%s)', (value) => {
    expect(Phone.safeParse(value).success).toBe(false)
  })
})

describe('RequestId', () => {
  it('валидный uuid проходит', () => {
    expect(RequestId.safeParse('11111111-1111-4111-8111-111111111111').success).toBe(true)
  })

  it('произвольная строка отклоняется', () => {
    expect(RequestId.safeParse('не-uuid').success).toBe(false)
  })
})

describe('RequestNumber', () => {
  it('формат ГГММ-NNN проходит', () => {
    expect(RequestNumber.safeParse('2609-001').success).toBe(true)
  })

  it('буквы в номере отклоняются', () => {
    expect(RequestNumber.safeParse('A609-001').success).toBe(false)
  })

  it('короче 4 символов отклоняется', () => {
    expect(RequestNumber.safeParse('123').success).toBe(false)
  })

  it('длиннее 12 символов отклоняется', () => {
    expect(RequestNumber.safeParse('1234567890123').success).toBe(false)
  })
})

describe('Token', () => {
  it.each([
    ['a'.repeat(21), false, '21 символ'],
    ['a'.repeat(22), true, '22 символа'],
    ['a'.repeat(64), true, '64 символа'],
    ['a'.repeat(65), false, '65 символов'],
    [`${'a'.repeat(20)}+_`, false, "содержит '+'"],
    [`${'a'.repeat(20)}/_`, false, "содержит '/'"],
  ])('%s → %s (%s)', (value, expected) => {
    expect(Token.safeParse(value).success).toBe(expected)
  })
})

describe('OtpCode', () => {
  it.each([
    ['1234', true],
    ['123', false],
    ['1234567', false],
    ['abcd', false],
  ])('%s → %s', (value, expected) => {
    expect(OtpCode.safeParse(value).success).toBe(expected)
  })
})

describe('Iso', () => {
  it('валидная ISO-8601 UTC строка проходит', () => {
    expect(Iso.safeParse('2026-09-15T10:00:00.000Z').success).toBe(true)
  })

  it('произвольная строка отклоняется', () => {
    expect(Iso.safeParse('вчера').success).toBe(false)
  })
})

describe('City', () => {
  it("code:'other' без name отклоняется", () => {
    expect(City.safeParse({ code: 'other', name: null }).success).toBe(false)
  })

  it("code:'other' с name проходит", () => {
    expect(City.safeParse({ code: 'other', name: 'Караганда' }).success).toBe(true)
  })

  it("code:'almaty' с name:null проходит", () => {
    expect(City.safeParse({ code: 'almaty', name: null }).success).toBe(true)
  })
})

describe('CityCode', () => {
  it('almaty — валидное значение', () => {
    expect(CityCode.safeParse('almaty').success).toBe(true)
  })

  it('неизвестный код отклоняется', () => {
    expect(CityCode.safeParse('novosibirsk').success).toBe(false)
  })
})

describe('CategoryId', () => {
  it('kitchen — валидная категория', () => {
    expect(CategoryId.safeParse('kitchen').success).toBe(true)
  })

  it('неизвестная категория отклоняется', () => {
    expect(CategoryId.safeParse('sofa').success).toBe(false)
  })
})

describe('MainSize', () => {
  it('known:false — самостоятельный валидный вариант', () => {
    expect(MainSize.safeParse({ known: false }).success).toBe(true)
  })

  it('known:true с meters — валиден', () => {
    expect(MainSize.safeParse({ known: true, meters: 3.2 }).success).toBe(true)
  })

  it.each([0, -1, 31])('meters:%d отклоняется', (meters) => {
    expect(MainSize.safeParse({ known: true, meters }).success).toBe(false)
  })

  it('known:true без meters отклоняется', () => {
    expect(MainSize.safeParse({ known: true }).success).toBe(false)
  })
})

describe('Details — дискриминированный union по category', () => {
  it('kitchen с валидными shape/appliances проходит', () => {
    expect(
      Details.safeParse({ category: 'kitchen', shape: 'corner', appliances: 'yes' }).success,
    ).toBe(true)
  })

  it('kitchen с невалидным shape отклоняется', () => {
    expect(Details.safeParse({ category: 'kitchen', shape: 'foo' }).success).toBe(false)
  })

  it('лишнее поле ветки кухни у шкафа отклоняется', () => {
    expect(Details.safeParse({ category: 'wardrobe', shape: 'corner' }).success).toBe(false)
  })

  it('неизвестная категория отклоняется', () => {
    expect(Details.safeParse({ category: 'unknown' }).success).toBe(false)
  })
})

describe('CreateRequest', () => {
  it('валидный payload для кухни проходит', () => {
    expect(CreateRequest.safeParse(validCreateRequest()).success).toBe(true)
  })

  it('пустое description отклоняется', () => {
    expect(CreateRequest.safeParse(validCreateRequest({ description: '' })).success).toBe(false)
  })

  it('description из пробелов отклоняется (trim)', () => {
    expect(CreateRequest.safeParse(validCreateRequest({ description: '   ' })).success).toBe(
      false,
    )
  })

  it('description длиной 2001 символ отклоняется', () => {
    expect(
      CreateRequest.safeParse(validCreateRequest({ description: 'а'.repeat(2001) })).success,
    ).toBe(false)
  })

  it('description длиной 1 символ проходит', () => {
    expect(CreateRequest.safeParse(validCreateRequest({ description: 'а' })).success).toBe(true)
  })

  it('district/deadline/finishLevel можно не передавать', () => {
    const payload = validCreateRequest()
    expect(CreateRequest.safeParse(payload).success).toBe(true)
  })

  it("finishLevel:'gold' отклоняется", () => {
    expect(CreateRequest.safeParse(validCreateRequest({ finishLevel: 'gold' })).success).toBe(
      false,
    )
  })

  it('без consent заявка не создаётся: согласие обязательно (US-11)', () => {
    const { consent, ...withoutConsent } = validCreateRequest() as Record<string, unknown>
    expect(consent).toBeDefined()
    const parsed = CreateRequest.safeParse(withoutConsent)
    expect(parsed.success).toBe(false)
    // Путь ошибки важен: по нему экран подсвечивает отметку, а не форму целиком.
    expect(parsed.error?.issues.some((issue) => issue.path[0] === 'consent')).toBe(true)
  })

  it('согласие без версии политики не принимается — доказывать нечем', () => {
    const payload = validCreateRequest({ consent: { acceptedAt: '2026-09-16T10:00:00.000Z' } })
    expect(CreateRequest.safeParse(payload).success).toBe(false)
  })

  it('clientRequestId не-uuid отклоняется', () => {
    expect(
      CreateRequest.safeParse(validCreateRequest({ clientRequestId: 'не-uuid' })).success,
    ).toBe(false)
  })

  it('clientRequestId валидный uuid проходит', () => {
    expect(
      CreateRequest.safeParse(
        validCreateRequest({ clientRequestId: '22222222-2222-4222-8222-222222222222' }),
      ).success,
    ).toBe(true)
  })
})

describe('RequestStatus', () => {
  it.each([
    'unconfirmed',
    'qualified',
    'incomplete',
    'out_of_coverage',
    'unreached',
    'routed',
    'quoted',
    'closed',
  ])('%s — валидное значение', (status) => {
    expect(RequestStatus.safeParse(status).success).toBe(true)
  })

  it('неизвестный статус отклоняется', () => {
    expect(RequestStatus.safeParse('foo').success).toBe(false)
  })
})

describe('OtpSent', () => {
  it('валидная форма проходит', () => {
    expect(OtpSent.safeParse({ channel: 'sms', codeLength: 4, retryAfterSec: 0 }).success).toBe(
      true,
    )
  })

  it('неизвестный channel отклоняется', () => {
    expect(
      OtpSent.safeParse({ channel: 'email', codeLength: 4, retryAfterSec: 0 }).success,
    ).toBe(false)
  })

  it('codeLength вне диапазона 4..6 отклоняется', () => {
    expect(
      OtpSent.safeParse({ channel: 'sms', codeLength: 3, retryAfterSec: 0 }).success,
    ).toBe(false)
    expect(
      OtpSent.safeParse({ channel: 'sms', codeLength: 7, retryAfterSec: 0 }).success,
    ).toBe(false)
  })
})

describe('RequestCreated', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    number: '2609-001',
    status: 'unconfirmed' as const,
    createdAt: '2026-09-15T10:00:00.000Z',
    otp: { channel: 'sms' as const, codeLength: 4, retryAfterSec: 0 },
  }

  it('валидная форма проходит', () => {
    expect(RequestCreated.safeParse(base).success).toBe(true)
  })

  it('status отличный от unconfirmed отклоняется', () => {
    expect(RequestCreated.safeParse({ ...base, status: 'qualified' }).success).toBe(false)
  })

  it('token в ответе createRequest не встречается (выдаётся только в confirmOtp)', () => {
    expect('token' in base).toBe(false)
  })
})

describe('ResendOtpInput', () => {
  it('валидный requestId проходит', () => {
    expect(
      ResendOtpInput.safeParse({ requestId: '11111111-1111-4111-8111-111111111111' }).success,
    ).toBe(true)
  })

  it('невалидный requestId отклоняется', () => {
    expect(ResendOtpInput.safeParse({ requestId: 'abc' }).success).toBe(false)
  })
})

describe('ConfirmOtpInput', () => {
  it('валидные requestId и code проходят', () => {
    expect(
      ConfirmOtpInput.safeParse({
        requestId: '11111111-1111-4111-8111-111111111111',
        code: '1234',
      }).success,
    ).toBe(true)
  })

  it('без code отклоняется', () => {
    expect(
      ConfirmOtpInput.safeParse({ requestId: '11111111-1111-4111-8111-111111111111' }).success,
    ).toBe(false)
  })
})

function validRequestForClient(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  }
}

describe('RequestForClient — проекция без ПДн', () => {
  it('валидная проекция без phone/id проходит', () => {
    expect(RequestForClient.safeParse(validRequestForClient()).success).toBe(true)
  })

  it('объект с полем phone не проходит строгий парс', () => {
    expect(
      RequestForClient.safeParse(validRequestForClient({ phone: '+77012345678' })).success,
    ).toBe(false)
  })

  it('объект с полем id не проходит строгий парс', () => {
    expect(
      RequestForClient.safeParse(
        validRequestForClient({ id: '11111111-1111-4111-8111-111111111111' }),
      ).success,
    ).toBe(false)
  })
})

describe('RequestConfirmed', () => {
  it('request + token проходит', () => {
    expect(
      RequestConfirmed.safeParse({
        request: validRequestForClient(),
        token: 'a'.repeat(22),
      }).success,
    ).toBe(true)
  })

  it('без token отклоняется', () => {
    expect(RequestConfirmed.safeParse({ request: validRequestForClient() }).success).toBe(false)
  })
})

function validQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    requestId: '11111111-1111-4111-8111-111111111111',
    master: { id: '44444444-4444-4444-8444-444444444444', name: 'Мастерская «Дуб»', phone: '+77010000001' },
    composition: {
      items: ['bodies', 'doors', 'countertop', 'appliances'],
      excluded: 'Техника покупается отдельно',
    },
    price: { minKzt: 500000, maxKzt: 700000 },
    leadTimeDays: 30,
    photos: [],
    sentAt: '2026-09-15T10:00:00.000Z',
    updatedAt: null,
    ...overrides,
  }
}

describe('Quote', () => {
  it('валидное КП проходит', () => {
    expect(Quote.safeParse(validQuote()).success).toBe(true)
  })

  it('price.minKzt > price.maxKzt отклоняется', () => {
    expect(
      Quote.safeParse(validQuote({ price: { minKzt: 500000, maxKzt: 400000 } })).success,
    ).toBe(false)
  })

  it('price.minKzt === price.maxKzt проходит', () => {
    expect(
      Quote.safeParse(validQuote({ price: { minKzt: 500000, maxKzt: 500000 } })).success,
    ).toBe(true)
  })

  it('leadTimeDays:0 отклоняется', () => {
    expect(Quote.safeParse(validQuote({ leadTimeDays: 0 })).success).toBe(false)
  })

  it('photos длиной 4 отклоняется (максимум 3)', () => {
    expect(
      Quote.safeParse(
        validQuote({
          photos: [
            'https://example.com/1.jpg',
            'https://example.com/2.jpg',
            'https://example.com/3.jpg',
            'https://example.com/4.jpg',
          ],
        }),
      ).success,
    ).toBe(false)
  })
})

describe('EventType', () => {
  it.each([
    'visit',
    'continue_clicked',
    'category_selected',
    'required_filled',
    'request_submitted',
    'otp_requested',
    'otp_confirmed',
    'routed',
    'master_opened',
    'quote_sent',
    'client_page_opened',
    'contact_made',
    'manual_completion',
    'request_closed',
  ])('%s — валидный тип события', (type) => {
    expect(EventType.safeParse(type).success).toBe(true)
  })

  it('неизвестный тип события отклоняется', () => {
    expect(EventType.safeParse('unknown_event').success).toBe(false)
  })
})

describe('Event', () => {
  it('событие без requestId (visit) валидно', () => {
    expect(
      Event.safeParse({
        id: '55555555-5555-4555-8555-555555555555',
        type: 'visit',
        at: '2026-09-15T10:00:00.000Z',
        requestId: null,
        actor: { role: 'client' },
      }).success,
    ).toBe(true)
  })

  it('событие без обязательного type отклоняется', () => {
    expect(
      Event.safeParse({
        id: '55555555-5555-4555-8555-555555555555',
        at: '2026-09-15T10:00:00.000Z',
        requestId: null,
        actor: { role: 'client' },
      }).success,
    ).toBe(false)
  })
})

describe('ErrorCode', () => {
  it.each([
    'VALIDATION_FAILED',
    'REQUEST_NOT_FOUND',
    'OTP_INVALID',
    'OTP_EXPIRED',
    'OTP_ATTEMPTS_EXCEEDED',
    'OTP_RESEND_TOO_SOON',
    'ALREADY_CONFIRMED',
    'TOKEN_INVALID',
    'RATE_LIMITED',
    'INTERNAL',
  ])('%s — валидный код ошибки', (code) => {
    expect(ErrorCode.safeParse(code).success).toBe(true)
  })

  it('неизвестный код отклоняется', () => {
    expect(ErrorCode.safeParse('FOO').success).toBe(false)
  })
})

describe('ApiErrorBody', () => {
  it('OTP_RESEND_TOO_SOON с retryAfterSec проходит', () => {
    expect(
      ApiErrorBody.safeParse({
        code: 'OTP_RESEND_TOO_SOON',
        message: 'подождите',
        retryAfterSec: 30,
      }).success,
    ).toBe(true)
  })

  it('OTP_RESEND_TOO_SOON без retryAfterSec отклоняется', () => {
    expect(
      ApiErrorBody.safeParse({ code: 'OTP_RESEND_TOO_SOON', message: 'подождите' }).success,
    ).toBe(false)
  })

  it('VALIDATION_FAILED требует fields', () => {
    expect(
      ApiErrorBody.safeParse({
        code: 'VALIDATION_FAILED',
        message: 'ошибка',
        fields: [{ path: 'phone', message: 'неверный формат' }],
      }).success,
    ).toBe(true)
    expect(
      ApiErrorBody.safeParse({ code: 'VALIDATION_FAILED', message: 'ошибка' }).success,
    ).toBe(false)
  })

  it('неизвестный код отклоняется', () => {
    expect(ApiErrorBody.safeParse({ code: 'FOO', message: 'ошибка' }).success).toBe(false)
  })
})

describe('ErrorEnvelope', () => {
  it('{ error: { code: OTP_RESEND_TOO_SOON, message, retryAfterSec } } проходит', () => {
    expect(
      ErrorEnvelope.safeParse({
        error: { code: 'OTP_RESEND_TOO_SOON', message: 'подождите', retryAfterSec: 30 },
      }).success,
    ).toBe(true)
  })

  it('тот же код без retryAfterSec отклоняется', () => {
    expect(
      ErrorEnvelope.safeParse({
        error: { code: 'OTP_RESEND_TOO_SOON', message: 'подождите' },
      }).success,
    ).toBe(false)
  })

  it('неизвестный код отклоняется', () => {
    expect(
      ErrorEnvelope.safeParse({ error: { code: 'FOO', message: 'подождите' } }).success,
    ).toBe(false)
  })
})

/**
 * US-10 — снимки помещения. Схема держит три границы: тип файла, размер
 * и количество. Каждая из них — то, что обязан проверять сервер, и то,
 * на чём экран обязан уметь показать отказ.
 */
describe('Photo и Photos — US-10', () => {
  const valid = {
    id: '3f1b8a2e-8c4d-4a6b-9f2e-1a2b3c4d5e6f',
    url: 'blob:http://localhost/3f1b8a2e',
    name: 'kitchen.jpg',
    bytes: 1_200_000,
    mime: 'image/jpeg',
  }

  it('валидный снимок проходит', () => {
    expect(Photo.safeParse(valid).success).toBe(true)
  })

  it('heic принимается — так снимает iPhone по умолчанию', () => {
    expect(Photo.safeParse({ ...valid, mime: 'image/heic' }).success).toBe(true)
  })

  it('чужой тип файла отклоняется', () => {
    expect(Photo.safeParse({ ...valid, mime: 'application/pdf' }).success).toBe(false)
  })

  it('файл больше десяти мегабайт отклоняется', () => {
    expect(Photo.safeParse({ ...valid, bytes: PHOTO_MAX_BYTES + 1 }).success).toBe(false)
  })

  it('пустой список законен: фото не блокирует отправку', () => {
    expect(Photos.safeParse([]).success).toBe(true)
  })

  it('шестой снимок отклоняется', () => {
    const many = Array.from({ length: PHOTO_MAX_COUNT + 1 }, (_, i) => ({
      ...valid,
      id: `3f1b8a2e-8c4d-4a6b-9f2e-1a2b3c4d5e${String(i).padStart(2, '0')}`,
    }))
    expect(Photos.safeParse(many).success).toBe(false)
  })
})

describe('Details — шкаф (US-06)', () => {
  it('двери и высота необязательны: заявка без них валидна', () => {
    const parsed = Details.parse({ category: 'wardrobe' })
    expect(parsed).toEqual({ category: 'wardrobe', doors: null, toCeiling: null })
  })

  it('купе и «до потолка» проходят', () => {
    const value = { category: 'wardrobe', doors: 'sliding', toCeiling: true }
    expect(Details.safeParse(value).success).toBe(true)
  })

  it('выдуманный тип дверей отклоняется, а не проглатывается', () => {
    expect(Details.safeParse({ category: 'wardrobe', doors: 'revolving' }).success).toBe(false)
  })

  it('поля шкафа в ветку кухни не протаскиваются', () => {
    const value = { category: 'kitchen', shape: 'corner', appliances: 'yes', doors: 'sliding' }
    expect(Details.safeParse(value).success).toBe(false)
  })
})

describe('кабинет мебельщика — схемы US-14, US-17, US-19a', () => {
  const master = {
    id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    name: 'Мастерская на Сайране',
    city: { code: 'almaty', name: null },
    phone: '+77010000001',
    acceptingFrom: '2026-09-01T00:00:00.000Z',
  }

  it('«на приёме» — дата, а не флаг: null законен, булево нет', () => {
    expect(Master.safeParse({ ...master, acceptingFrom: null }).success).toBe(true)
    expect(Master.safeParse({ ...master, acceptingFrom: true }).success).toBe(false)
  })

  it('MasterProfile строгий: телефон в него не протащить', () => {
    const profile = { id: master.id, name: master.name, city: master.city }
    expect(MasterProfile.safeParse(profile).success).toBe(true)
    expect(MasterProfile.safeParse({ ...profile, phone: master.phone }).success).toBe(false)
  })

  it('маршрут — не больше трёх получателей и не меньше одного', () => {
    const base = { requestId: '3f1b8a2e-8c4d-4a6b-9f2e-1a2b3c4d5e01', routedAt: master.acceptingFrom }
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => `aaaaaaa${i + 1}-aaaa-4aaa-8aaa-aaaaaaaaaaa${i + 1}`)
    expect(Routing.safeParse({ ...base, masterIds: ids(3) }).success).toBe(true)
    expect(Routing.safeParse({ ...base, masterIds: ids(4) }).success).toBe(false)
    expect(Routing.safeParse({ ...base, masterIds: [] }).success).toBe(false)
  })

  describe('CreateQuote', () => {
    const valid = {
      composition: {
        items: ['bodies', 'doors', 'countertop', 'sink', 'delivery'],
        extra: 'Столешница с фрезеровкой под сушку',
        excluded: 'Замер и подъём на этаж без лифта оплачиваются отдельно',
      },
      price: { minKzt: 900_000, maxKzt: 1_400_000 },
      leadTimeDays: 30,
    }

    it('вилка обязательна: одиночного числа схема не знает', () => {
      expect(CreateQuote.safeParse(valid).success).toBe(true)
      expect(CreateQuote.safeParse({ ...valid, price: { minKzt: 900_000 } }).success).toBe(false)
    })

    it('равные границы проходят — это твёрдая цена, законный ответ', () => {
      const price = { minKzt: 1_000_000, maxKzt: 1_000_000 }
      expect(CreateQuote.safeParse({ ...valid, price }).success).toBe(true)
    })

    it('перевёрнутая вилка отклоняется', () => {
      const price = { minKzt: 1_400_000, maxKzt: 900_000 }
      expect(CreateQuote.safeParse({ ...valid, price }).success).toBe(false)
    })

    it('срок изготовления — положительное число дней', () => {
      expect(CreateQuote.safeParse({ ...valid, leadTimeDays: 0 }).success).toBe(false)
    })

    it('состав без единой позиции не проходит: есть цена и не сказано, за что', () => {
      const composition = { ...valid.composition, items: [] }
      expect(CreateQuote.safeParse({ ...valid, composition }).success).toBe(false)
    })

    it('позиция, отмеченная дважды, отклоняется — дубль дал бы две строки в матрице', () => {
      const composition = { ...valid.composition, items: ['bodies', 'bodies'] }
      expect(CreateQuote.safeParse({ ...valid, composition }).success).toBe(false)
    })

    it('позиции вне перечня контракта не существует', () => {
      const composition = { ...valid.composition, items: ['ldsp'] }
      expect(CreateQuote.safeParse({ ...valid, composition }).success).toBe(false)
    })

    it('«что не входит» обязательно, и строка из пробелов им не считается', () => {
      const { excluded: _drop, ...withoutExcluded } = valid.composition
      expect(CreateQuote.safeParse({ ...valid, composition: withoutExcluded }).success).toBe(false)
      const blank = { ...valid.composition, excluded: '   ' }
      expect(CreateQuote.safeParse({ ...valid, composition: blank }).success).toBe(false)
    })

    it('«ещё своими словами» необязательно: перечня хватает', () => {
      const { extra: _drop, ...composition } = valid.composition
      expect(CreateQuote.safeParse({ ...valid, composition }).success).toBe(true)
    })

    it('категория позиции не проверяется: замер в заявке на шкаф — не ошибка', () => {
      const composition = { ...valid.composition, items: ['rails', 'measure'] }
      expect(CreateQuote.safeParse({ ...valid, composition }).success).toBe(true)
    })

    it('мебельщика в теле запроса нет — сервер ставит его из сессии', () => {
      const withMaster = { ...valid, master: { id: master.id, name: master.name } }
      // z.object не строгий, лишнее поле отбрасывается — важно, что оно
      // не доезжает до Quote: имя отправителя КП не выбирается клиентом.
      const parsed = CreateQuote.parse(withMaster) as Record<string, unknown>
      expect('master' in parsed).toBe(false)
    })
  })

  describe('проекции заявки для мебельщика', () => {
    const listItem = {
      id: '3f1b8a2e-8c4d-4a6b-9f2e-1a2b3c4d5e01',
      number: '2609-014',
      routedAt: '2026-09-16T10:00:00.000Z',
      category: 'kitchen',
      mainSize: { known: true, meters: 3.2 },
      city: { code: 'almaty', name: null },
      district: null,
      deadline: null,
      photosCount: 3,
      quotedByMe: false,
    }

    it('список принимает проекцию целиком', () => {
      expect(RequestForMasterListItem.safeParse(listItem).success).toBe(true)
    })

    it('телефон в списке — ошибка разбора, а не тихая находка на проде', () => {
      const leaked = { ...listItem, clientPhone: '+77012345678' }
      expect(RequestForMasterListItem.safeParse(leaked).success).toBe(false)
    })

    it('описание и снимки в список не попадают — их место в карточке', () => {
      expect(RequestForMasterListItem.safeParse({ ...listItem, description: 'текст' }).success).toBe(
        false,
      )
    })

    it('статуса в проекции нет: мебельщику полезен один бит quotedByMe', () => {
      expect(RequestForMasterListItem.safeParse({ ...listItem, status: 'routed' }).success).toBe(
        false,
      )
    })

    const card = {
      id: listItem.id,
      number: listItem.number,
      routedAt: listItem.routedAt,
      details: { category: 'kitchen', shape: 'corner', appliances: 'yes' },
      mainSize: listItem.mainSize,
      description: 'Кухня в новостройке, нужен расчёт',
      city: listItem.city,
      district: null,
      deadline: null,
      finishLevel: null,
      photos: [],
      myQuote: null,
      clientPhone: null,
    }

    it('карточка до отправки КП: телефон null, своего КП нет', () => {
      expect(RequestForMaster.safeParse(card).success).toBe(true)
    })

    it('карточка после КП принимает номер клиента', () => {
      const after = { ...card, clientPhone: '+77012345678' }
      expect(RequestForMaster.safeParse(after).success).toBe(true)
    })

    it('чужих КП в карточке нет — поле quotes схемой не предусмотрено', () => {
      expect(RequestForMaster.safeParse({ ...card, quotes: [] }).success).toBe(false)
    })
  })
})

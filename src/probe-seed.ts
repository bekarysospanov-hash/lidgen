// PROBE: демонстрационные заявки для дев-режима. Мок держит состояние
// в памяти вкладки, поэтому после каждой перезагрузки кабинет пуст —
// смотреть список заявок не на чем. Здесь создаётся несколько заявок тем же
// путём, которым их создаёт заказчица: через контракт, а не записью в стор.
//
// Удаляется вместе с оболочкой пробы — ищется грепом "PROBE:" (CLAUDE.md).
import { api } from './api/client'
import { POLICY_VERSION } from './texts/privacy'

interface Seed {
  description: string
  /** null — заявка без размеров: с 18.09 такие доходят до кабинета как есть. */
  meters: number | null
  shape: 'straight' | 'corner' | 'u-shape' | 'island'
  appliances: 'yes' | 'no' | 'undecided'
  district: string | null
  phone: string
  readiness?: 'ready' | 'planning'
  /** Поля полного пути — заполнены только у той заявки, где человек их назвал. */
  full?: {
    secondWallM?: number
    thirdWallM?: number
    ceilingM?: number
    upper?: 'open' | 'closed' | 'attic'
    applianceList?: ('oven' | 'hob' | 'dishwasher' | 'fridge' | 'hood' | 'microwave')[]
  }
}

/**
 * Настоящие числа и формулировки, а не «заявка 1» и «тест»: список из
 * заглушек не показывает, читается ли экран (DESIGN.md § Presence).
 */
const SEEDS: Seed[] = [
  {
    description:
      'Кухня в новостройке, окно по центру стены. Хочется светлые фасады ' +
      'и высокие шкафы до потолка.',
    meters: 3.2,
    shape: 'straight',
    appliances: 'yes',
    district: 'ЖК «Алматы Сити»',
    phone: '+77012345678',
  },
  {
    description:
      'Угловая кухня, второй этаж без лифта. Нужна встроенная техника ' +
      'и место под посудомойку.',
    meters: 4.5,
    shape: 'corner',
    appliances: 'yes',
    district: 'Орбита-3',
    phone: '+77021234567',
  },
  {
    description: 'Небольшая кухня для съёмной квартиры, бюджетно, без изысков.',
    meters: 2.4,
    shape: 'straight',
    appliances: 'no',
    district: null,
    phone: '+77471234567',
  },
  // Полный путь: человек назвал всё, что спросили. Такая заявка и есть
  // цель полного пути — по ней цена считается не выезжая.
  {
    description:
      'П-образная кухня, окно между двумя стенами. Верх до потолка, ' +
      'технику уже купили — вся встроенная.',
    // 3,8 а не 3,6: размер 3,6 занят сквозным тестом e2e, и заявка с тем же
    // числом перехватывала у него строку списка — тест отвечал на демо-заявку.
    meters: 3.8,
    shape: 'u-shape',
    appliances: 'yes',
    district: 'ЖК «Тенгиз»',
    phone: '+77015550101',
    readiness: 'ready',
    full: {
      secondWallM: 2.4,
      thirdWallM: 1.8,
      ceilingM: 2.7,
      upper: 'attic',
      applianceList: ['oven', 'hob', 'dishwasher', 'hood'],
    },
  },
  // Короткий путь: размеров нет, зато есть описание. До 18.09 такая заявка
  // не доходила до кабинета вовсе — ждала дозвона, которого не будет.
  {
    description:
      'Пока присматриваюсь. Кухня в двушке, хочется без ручек и светлую. ' +
      'Размеры скажу, когда доберусь с рулеткой.',
    meters: null,
    shape: 'straight',
    appliances: 'undecided',
    district: null,
    phone: '+77015550202',
    readiness: 'planning',
  },
]

let seeded = false

export async function seedProbeRequests(): Promise<void> {
  if (seeded) return
  seeded = true

  for (const seed of SEEDS) {
    try {
      const created = await api.createRequest({
        details: {
          category: 'kitchen',
          shape: seed.shape,
          appliances: seed.appliances,
          ...seed.full,
        },
        mainSize: seed.meters === null ? { known: false } : { known: true, meters: seed.meters },
        readiness: seed.readiness ?? null,
        description: seed.description,
        city: { code: 'almaty', name: null },
        phone: seed.phone,
        district: seed.district,
        // Согласие обязательно с US-11: демо-заявка проходит тот же путь,
        // что и настоящая, включая отметку на форме.
        consent: { policyVersion: POLICY_VERSION, acceptedAt: new Date().toISOString() },
      })
      // Подтверждение — то же, что делает человек в форме: без него заявка
      // не классифицируется и никому не маршрутизируется.
      await api.confirmOtp({ requestId: created.id, code: '1234' })
    } catch {
      // Сид — декорация. Если он не прошёл, экраны обязаны работать дальше
      // и показывать честное пустое состояние, а не падать.
    }
  }
}

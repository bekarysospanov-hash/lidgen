// PROBE: мебельщики на приёме и сессии кабинета — стенд-ин серверных данных
// (docs/api-contract.md §2 Master, §10). На проде это карточки, заведённые
// нами (A2), и их правка — US-20; здесь список константный, а вход проходит
// по тому же коду 1234, что и у заявки.
import {
  MASTER_SESSION_TTL_HOURS,
  MasterCardPublic,
  MyCard,
  UpdateMyCard,
  type City,
  type Master,
} from '../../contract'
import { ApiError } from '../errors'
import { newId, newToken } from './store'
// PROBE: те же три снимка, что на лендинге. Карточка с данными до сих пор
// не была отрисована ни разу — экраны каталога, публичной карточки и «Моей
// карточки» проверялись только в пустых состояниях (хэндовер, «Долги»).
import bedroom from '../../assets/probe/bedroom.jpg'
import cabinet from '../../assets/probe/cabinet.jpg'
import kitchen from '../../assets/probe/kitchen.jpg'

/**
 * Семь мастерских — столько же, сколько в каталоге US-02. Имена и номера
 * вымышленные: заявки на скелете ходят по нашим собственным номерам, и
 * подставлять сюда названия реальных мастерских до их согласия нельзя.
 *
 * ⚠️ Настоящие номера мебельщиков в этот файл не вписывать. Он уходит
 * в git и остаётся в истории навсегда, а это ПДн семи человек. Настоящие
 * карточки заводятся на стороне сервера (A2), и до тех пор номер для входа
 * берётся отсюда только в пробе. Вместе с этим списком снимается и подсказка
 * на экране входа — она привязана к тому же признаку «данные ненастоящие»
 * (src/texts/master.ts, probeVisible).
 */
const city = (code: 'almaty' | 'astana' | 'shymkent'): City => ({ code, name: null })

const ACCEPTING_FROM = '2026-09-01T00:00:00.000Z'

/**
 * Карточки каталога у всех семи — null, и это не недоделка (US-02).
 * Публиковать можно только настоящие мастерские, давшие согласие, со своими
 * работами на фотографиях: сгенерированные карточки и чужие портфолио
 * запрещены PRD и контрактом. Здесь их взять неоткуда — карточки приходят
 * треком A2, из разговоров с живыми мебельщиками.
 *
 * Пока согласий нет, каталог законно пуст, и экран это показывает словами.
 *
 * PROBE-исключение с 18.09: у первой мастерской карточка заполнена
 * демонстрационными данными — ниже, `PROBE_CARD`. Иначе три экрана из
 * двенадцати нельзя посмотреть вообще: они показывают только пустоту,
 * и как выглядит заполненная карточка, никто до сих пор не видел.
 */

/**
 * PROBE: демонстрационная карточка. Тексты и число лет написаны нами для
 * показа, снимки — те же временные кадры, что на лендинге. Заменяется
 * настоящей карточкой с согласия мастерской (трек A2) и удаляется по
 * грепу `PROBE:` вместе с остальной оболочкой.
 *
 * `yearsOnMarket` схема требует целым и обязательным, поэтому число здесь
 * есть — но оно демонстрационное, как метражи в демо-заявках.
 */
const PROBE_CARD = {
  about:
    'Небольшой цех на Сайране: два столяра и сборщик. Делаем кухни и шкафы ' +
    'по своим чертежам, монтаж ведём сами, без подрядчиков. Берём три-четыре ' +
    'заказа в месяц — чтобы не растягивать сроки.',
  yearsOnMarket: 12,
  does: ['Кухни', 'Шкафы-купе', 'Гардеробные', 'Мебель для ванной'],
  photos: [kitchen, cabinet, bedroom],
  publishedAt: '2026-09-18T06:00:00.000Z',
}

const MASTERS: Master[] = [
  {
    id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    name: 'Мастерская на Сайране',
    city: city('almaty'),
    phone: '+77010000001',
    acceptingFrom: ACCEPTING_FROM,
    // PROBE: единственная заполненная карточка — см. PROBE_CARD выше.
    card: PROBE_CARD,
  },
  {
    id: 'aaaaaaa2-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    name: 'Цех 12',
    city: city('almaty'),
    phone: '+77010000002',
    acceptingFrom: ACCEPTING_FROM,
    card: null,
  },
  {
    id: 'aaaaaaa3-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    name: 'Дом фасадов',
    city: city('almaty'),
    phone: '+77010000003',
    acceptingFrom: ACCEPTING_FROM,
    card: null,
  },
  {
    id: 'aaaaaaa4-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    name: 'Столярка у вокзала',
    city: city('astana'),
    phone: '+77010000004',
    acceptingFrom: ACCEPTING_FROM,
    card: null,
  },
  {
    id: 'aaaaaaa5-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
    name: 'Мебель на Сарыарке',
    city: city('astana'),
    phone: '+77010000005',
    acceptingFrom: ACCEPTING_FROM,
    card: null,
  },
  {
    id: 'aaaaaaa6-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
    name: 'Шымкентский цех',
    city: city('shymkent'),
    phone: '+77010000006',
    acceptingFrom: ACCEPTING_FROM,
    card: null,
  },
  {
    id: 'aaaaaaa7-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
    name: 'Мастерская братьев',
    city: city('shymkent'),
    phone: '+77010000007',
    acceptingFrom: ACCEPTING_FROM,
    card: null,
  },
]

export function listMasters(): Master[] {
  return [...MASTERS]
}

export function getMaster(id: string): Master | undefined {
  return MASTERS.find((master) => master.id === id)
}

export function findMasterByPhone(phone: string): Master | undefined {
  return MASTERS.find((master) => master.phone === phone)
}

/**
 * Кто сейчас принимает заявки в городе. По этому же списку считается
 * покрытие (§2, City): город покрыт, если такой мебельщик хотя бы один.
 */
export function listAcceptingIn(cityCode: string): Master[] {
  return MASTERS.filter((master) => master.city.code === cityCode && master.acceptingFrom !== null)
}

interface Session {
  masterId: string
  /** Сессия кабинета живёт 12 часов — до конца рабочего дня (§3). */
  expiresAt: number
}

const sessions = new Map<string, Session>()

export function openSession(masterId: string, now: Date): string {
  const token = newToken()
  sessions.set(token, {
    masterId,
    expiresAt: now.getTime() + MASTER_SESSION_TTL_HOURS * 60 * 60 * 1000,
  })
  return token
}

/** Возвращает мебельщика по токену или undefined — протух, отозван, выдуман. */
export function resolveSession(token: string, now: Date): Master | undefined {
  const session = sessions.get(token)
  if (!session) return undefined
  if (session.expiresAt <= now.getTime()) {
    sessions.delete(token)
    return undefined
  }
  return getMaster(session.masterId)
}

export function resetSessions(): void {
  sessions.clear()
}

/** Идентификатор КП генерируется тем же способом, что и остальные (§10). */
export const newQuoteId = newId

/**
 * Каталог (US-02, §5 listMasters): только мастерские с заполненной карточкой.
 * Пустой список — законный ответ, а не ошибка: пока согласий нет, каталог
 * пуст, и выдумывать карточки запрещено.
 */
/**
 * US-03 — карточка одной мастерской. Мастерская без опубликованной карточки
 * отвечает так же, как несуществующая: для внешнего мира её здесь просто нет
 * (§5, getMasterCard). Приём заявок и публикация — разные решения.
 */
export function getCatalogueCard(id: string): MasterCardPublic {
  const master = MASTERS.find((item) => item.id === id)
  if (master === undefined || master.card === null) {
    throw new ApiError('MASTER_NOT_FOUND', 'Такой мастерской нет в каталоге')
  }
  return MasterCardPublic.parse({
    id: master.id,
    name: master.name,
    city: master.city,
    card: master.card,
  })
}

/**
 * US-20 — что мебельщик видит о себе. `card: null` законно: мастерская может
 * принимать заявки и не быть в каталоге, пока согласия на публикацию нет.
 */
export function readMyCard(master: Master): MyCard {
  return MyCard.parse({ name: master.name, city: master.city, card: master.card })
}

/**
 * US-20 — правка своей карточки. Меняется только текст: фотографии собираем
 * и проверяем мы (A2), а `publishedAt` — след согласия, и правка текста
 * не делает карточку опубликованной заново.
 *
 * Правка до публикации — не ошибка ввода, а несуществующий объект: карточка
 * не черновик мебельщика, а наша публикация с его согласия (§5б).
 */
export function writeMyCard(master: Master, patch: UpdateMyCard): MyCard {
  if (master.card === null) {
    throw new ApiError('CARD_NOT_PUBLISHED', 'Карточка ещё не опубликована')
  }
  master.card = { ...master.card, ...patch }
  return readMyCard(master)
}

export function listCatalogue(): MasterCardPublic[] {
  return MASTERS.filter((master) => master.card !== null).map((master) =>
    MasterCardPublic.parse({
      id: master.id,
      name: master.name,
      city: master.city,
      card: master.card,
    }),
  )
}

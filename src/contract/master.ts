// Мебельщик и маршрутизация (docs/api-contract.md §2, §3, §5б).
//
// Вторая половина среза 1: US-14 «маршрутизация троим», US-17 «вход
// мебельщика». Заявка, дошедшая до кабинета, — единственное, ради чего
// скелет собирается: без неё «момент истины» из story-map.md не наступает.
import { z } from 'zod'
import { City, Iso, Phone, RequestId } from './primitives'
import { CategoryId } from './request'

/** Не больше трёх получателей на заявку (US-14, §2 Routing). */
export const ROUTING_MAX_MASTERS = 3

/*
 * Срок сессии переехал в `contract/session.ts` вместе с самой сессией
 * (20.09): она стала общей на обе роли, и число у неё одно.
 */

/**
 * Пределы карточки одним местом. Экран обязан знать их до отправки: иначе
 * он пускает шестой пункт или 700 знаков рассказа, а схема отвергает это
 * уже на сервере, и человек получает «заявка не прошла проверку» вместо
 * указания, что именно чинить.
 */
export const CARD_LIMITS = {
  extras: 5,
  extraChars: 80,
  photos: 12,
  aboutChars: 600,
  captionChars: 80,
  serviceAreaChars: 120,
  warrantyMonths: 120,
  leadDays: 180,
} as const

/**
 * Услуги — закрытый список из восьми, а не свободный текст (§2).
 *
 * Закрытым он сделан по двум причинам сразу. Под каждое значение нарисован
 * знак, а произвольную строку рисовать нечем: набор иконок в системе
 * рисуется вручную и одним стилем (DESIGN.md § Иконки). И по закрытому
 * списку можно будет отбирать мастерские в каталоге — по свободному тексту
 * нельзя. Всё, что в восьмёрку не влезло, живёт в `extras` словами.
 */
export const MASTER_SERVICES = [
  'measure',
  'design',
  'delivery',
  'assembly',
  'dismantle',
  'appliances',
  'installments',
  'nonstandard',
] as const
export const MasterService = z.enum(MASTER_SERVICES)
export type MasterService = z.infer<typeof MasterService>

/**
 * Услуга с условием: входит в цену или считается отдельно. Разница взята
 * из бенчмарка мебельных сайтов (18.09): у всех изученных площадок замер,
 * доставка и монтаж перечислены списком без условия, и два предложения
 * с одинаковым списком оказываются несравнимыми — у одного монтаж в цене,
 * у другого «обсуждается».
 *
 * Третьего состояния — «не оказываем» — в данных нет: услуга, которой
 * мастерская не занимается, просто отсутствует в списке. Хранить восемь
 * записей ради трёх отмеченных значило бы держать в контракте перечень
 * отрицаний.
 */
export const ServiceOffer = z.strictObject({
  id: MasterService,
  /** true — за отдельную плату; false — входит в названную цену. */
  paid: z.boolean().default(false),
})
export type ServiceOffer = z.infer<typeof ServiceOffer>

/** Где мастерской удобнее отвечать. Почты не спрашиваем — ею не пользуются. */
export const Messenger = z.enum(['whatsapp', 'telegram'])
export type Messenger = z.infer<typeof Messenger>

/**
 * Снимок работы. `kind` — та же четвёрка, что у заявки: снимки на карточке
 * группируются по виду работ, иначе шесть кухонь подряд читаются как одна
 * кухня, и «делаем и шкафы тоже» остаётся словами.
 */
export const MasterPhoto = z.strictObject({
  url: z.string().min(1),
  kind: CategoryId,
  /** «Кухня 3,4 м, Алматы». Необязательна: подпись ради подписи хуже её отсутствия. */
  caption: z.string().trim().min(1).max(CARD_LIMITS.captionChars).nullable().default(null),
  /**
   * Рисунок, а не снимок готовой работы. Отмечается явно: по красивому
   * рендеру заказчик судит о качестве сборки, которой на картинке нет,
   * и это первое, на чём обжигаются каталоги мебели.
   */
  isRender: z.boolean().default(false),
})
export type MasterPhoto = z.infer<typeof MasterPhoto>

export const WeekDay = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
export type WeekDay = z.infer<typeof WeekDay>

/** Часы в формате HH:MM — 24-часовые, без am/pm: язык интерфейса русский. */
export const DayTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ожидается время вида 10:00')

/**
 * Когда отвечают. Днями и часами по отдельности, а не строкой «пн–сб 10–19»:
 * строку нельзя ни проверить, ни сравнить, а «работаем до 19» — обещание,
 * по которому человек решает, ждать ли ответа сегодня.
 */
export const WorkHours = z
  .strictObject({
    days: z.array(WeekDay).min(1).max(7),
    from: DayTime,
    to: DayTime,
  })
  .refine((value) => value.from < value.to, {
    message: 'Начало рабочего дня должно быть раньше конца',
    path: ['to'],
  })
  .refine((value) => new Set(value.days).size === value.days.length, {
    message: 'День недели не повторяется',
    path: ['days'],
  })
export type WorkHours = z.infer<typeof WorkHours>

/**
 * Срок изготовления вилкой. Точного срока у мебельщика не бывает: он зависит
 * от загрузки цеха, и названное одним числом обещание он же первым и нарушит.
 */
export const LeadTime = z
  .strictObject({
    min: z.int().min(1).max(CARD_LIMITS.leadDays),
    max: z.int().min(1).max(CARD_LIMITS.leadDays),
  })
  .refine((value) => value.min <= value.max, {
    message: 'Нижняя граница срока не больше верхней',
    path: ['max'],
  })
export type LeadTime = z.infer<typeof LeadTime>

const uniqueStrings = <T>(items: readonly T[]) => new Set(items).size === items.length

/**
 * Публичная карточка каталога (US-02). Появляется только после согласия
 * мастерской на публикацию и заполнения карточки нами (трек A2).
 *
 * Роли («своя мастерская / своё производство / проект и сопровождение»)
 * здесь была и снята 18.09 решением PM. Ни одна формулировка не проходила
 * проверку «так о себе напишет живой мебельщик»: слово про устройство
 * бизнеса, а заказчик выбирает по работам, услугам и срокам. Понадобится —
 * вернём, когда будет видно из разговоров, что этот вопрос вообще задают.
 *
 * Запрет, вынесенный из PRD в контракт: сгенерированные карточки, спарсенные
 * чужие портфолио и вымышленные мастерские «для объёма» недопустимы. Заявка
 * на несуществующее предложение делает CPL неинтерпретируемым, а чужие фото —
 * это чужое авторское право в среде, где работы узнают мгновенно.
 */
export const MasterCard = z.object({
  about: z.string().trim().min(1).max(CARD_LIMITS.aboutChars),
  yearsOnMarket: z.int().min(0),
  does: z.array(z.string().trim().min(1)).min(1).max(6),
  /**
   * Что мастерская делает — отметками, а не словами. Заведено 18.09 после
   * разбора: отбор в каталоге шёл по видам снимков, и мастерская, которая
   * делает ванные, но не сняла их, из отбора выпадала. Свободная строка
   * `does` осталась: она про слова мастерской, а этот список — про отбор,
   * и путать их нельзя. Совпадение четвёрки с категориями заявки
   * не случайно — по ним же однажды пойдёт маршрутизация.
   */
  categories: z
    .array(CategoryId)
    .min(1)
    .max(4)
    .refine(uniqueStrings, { message: 'Направление не повторяется' }),
  /** Что входит в работу и на каких условиях. Пустой список законен. */
  services: z
    .array(ServiceOffer)
    .max(MASTER_SERVICES.length)
    .default([])
    .refine((items) => uniqueStrings(items.map((item) => item.id)), {
      message: 'Услуга не повторяется',
    }),
  /**
   * Куда выезжают. Словами, а не списком городов: город мастерской уже
   * известен, а решает здесь пригород — «до 30 км за город» или «только
   * в черте города». Структуру завести будет из чего, когда наберутся
   * ответы семи мастерских; выдумывать её за них рано.
   */
  serviceArea: z.string().trim().min(1).max(CARD_LIMITS.serviceAreaChars).nullable().default(null),
  /** Чем отличается — своими словами, по строке на пункт. */
  extras: z.array(z.string().trim().min(1).max(CARD_LIMITS.extraChars)).max(CARD_LIMITS.extras).default([]),
  /** Свои работы, снятые у своих заказчиков. Ни одной чужой. */
  photos: z.array(MasterPhoto).min(1).max(CARD_LIMITS.photos),
  /** Знак мастерской. null — место под него на карточке просто пустует. */
  logo: z.string().min(1).nullable().default(null),
  warrantyMonths: z.int().min(0).max(CARD_LIMITS.warrantyMonths).nullable().default(null),
  leadTime: LeadTime.nullable().default(null),
  hours: WorkHours.nullable().default(null),
  /**
   * Контакт мастерской. Собирается, но заказчику в пробе не показывается:
   * решение «каталог — витрина доверия, контактов в нём нет» (PRD US-02)
   * в силе, контакт приходит вместе с предложением (US-24). Поле заведено
   * потому, что карточку заполняет мебельщик, и спросить номер один раз
   * дешевле, чем возвращаться к семи мастерским, когда решение изменится.
   */
  contactPhone: Phone.nullable().default(null),
  messengers: z
    .array(Messenger)
    .max(2)
    .default([])
    .refine(uniqueStrings, { message: 'Мессенджер не повторяется' }),
  publishedAt: Iso,
})
export type MasterCard = z.infer<typeof MasterCard>

/**
 * Карточка в том виде, в каком она уходит наружу.
 *
 * **Контакт вернулся в публичный ответ 20.09** — решение PM: каталог стал
 * маркетплейсом, и из карточки можно позвонить и написать, не оставляя
 * заявку. До этого он вырезался схемой (§5, 18.09), потому что действовало
 * правило «каталог — витрина доверия, контактов в нём нет».
 *
 * Цена размена названа здесь, чтобы её не потеряли: звонок из каталога
 * проходит мимо заявки, и метрика «вышел на контакт» (US-24) его не видит.
 * Считать такие выходы будет только событие `contact_made` со страницы
 * каталога — оно и отличает их от контактов по предложению.
 *
 * Телефон мастерской остаётся ПДн (§2): он публикуется с её согласия,
 * которое берётся при заведении карточки, и нигде больше не появляется.
 */
export const PublicMasterCard = MasterCard
export type PublicMasterCard = z.infer<typeof PublicMasterCard>

/** Что видит заказчик в каталоге. Телефона здесь нет: контакт — US-24. */
export const MasterCardPublic = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1),
  city: City,
  card: PublicMasterCard,
})
export type MasterCardPublic = z.infer<typeof MasterCardPublic>

/**
 * Мебельщик. Заводится нами (A2), самостоятельной регистрации в пробе нет:
 * правка своей карточки — US-20, срез 3.
 */
export const Master = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  city: City,
  /** По нему же вход в кабинет (US-17). Наружу уходит только в каталоге. */
  phone: Phone,
  /**
   * «На приёме» с этого момента. Не булев флаг: на разборе эксперимента
   * нужно уметь сказать, что заявка пришла до выхода мебельщика на приём,
   * а не угадывать это (§2).
   */
  acceptingFrom: Iso.nullable(),
  /**
   * Публичная карточка. null, пока согласия на публикацию нет: мастерская
   * может принимать заявки и не быть в каталоге — это разные решения.
   */
  card: MasterCard.nullable().default(null),
})
export type Master = z.infer<typeof Master>

/**
 * Проекция Master для него самого: телефон свой он знает, acceptingFrom —
 * наше служебное состояние, не его (§2).
 */
export const MasterProfile = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1),
  city: City,
})
export type MasterProfile = z.infer<typeof MasterProfile>

/**
 * Что мебельщик видит о себе в кабинете (§5б, getMyCard). US-20.
 *
 * `name` и `city` здесь для показа, а не для правки: город определяет, какие
 * заявки ему придут, и менять его самостоятельно он не может. `acceptingFrom`
 * не отдаётся вовсе — это наше служебное состояние, и его показ породил бы
 * вопрос «как включить», ответа на который в пробе нет.
 *
 * `card: null` — законное состояние, а не ошибка: мастерская может принимать
 * заявки и не быть в каталоге, пока согласия на публикацию нет.
 */
export const MyCard = z.strictObject({
  name: z.string().min(1),
  city: City,
  card: MasterCard.nullable(),
})
export type MyCard = z.infer<typeof MyCard>

/**
 * Тело updateMyCard (§5б). Всё, что мебельщик рассказывает о себе сам:
 * текст, направления, услуги, отличия, снимки работ, знак, гарантия, срок,
 * часы и контакт.
 *
 * Фотографии здесь с 18.09 — решение изменено. Раньше снимки собирали
 * и проверяли мы (A2), и запрет на чужие портфолио держался именно на этом;
 * но карточку заполняет мебельщик, и без своих работ заполнять её нечем.
 * Размен назван прямо: модерации в пробе нет, запрет держится на строке
 * при заполнении и на том, что мастерских семь и все знакомы лично.
 *
 * `publishedAt` по-прежнему не здесь: дата публикации — след согласия,
 * и правка карточки не делает её опубликованной заново.
 *
 * Название и город тоже не здесь: город решает, какие заявки придут,
 * и самостоятельная смена означала бы, что маршрутизация зависит
 * от настроения получателя (§5б).
 */
export const UpdateMyCard = MasterCard.pick({
  about: true,
  yearsOnMarket: true,
  does: true,
  categories: true,
  services: true,
  serviceArea: true,
  extras: true,
  photos: true,
  logo: true,
  warrantyMonths: true,
  leadTime: true,
  hours: true,
  contactPhone: true,
  messengers: true,
})
export type UpdateMyCard = z.infer<typeof UpdateMyCard>

/*
 * `MasterSession`, `MasterRequestCodeInput` и `MasterConfirmCodeInput`
 * сняты 20.09 (фаза contract, журнал §11): дверей стало одна на обе роли,
 * и сессия принадлежит человеку, а не мастерской. Их место занял
 * `Session` в `contract/session.ts`.
 */

/**
 * Кому ушла заявка. Серверная запись, целиком не отдаётся никому: заказчице
 * виден только факт (routedAt), мебельщику — только то, что заявка есть
 * в его списке. Переназначения нет: маршрут пишется один раз (§2).
 */
export const Routing = z.object({
  requestId: RequestId,
  masterIds: z.array(z.uuid()).min(1).max(ROUTING_MAX_MASTERS),
  routedAt: Iso,
})
export type Routing = z.infer<typeof Routing>

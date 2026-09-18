// US-20 — своя карточка. Мебельщик рассказывает о себе то, по чему его
// выберут: чем занимается, что делает, что входит в работу, чем отличается,
// сроки, гарантия, часы, контакт и свои работы.
//
// Что правится, а что нет (контракт §5б). Название и город меняем мы: город
// определяет, какие заявки ему придут, и самостоятельная смена означала бы,
// что маршрутизация зависит от настроения получателя. Телефон входа — вход
// в кабинет, и телефон мастерской в карточке от него отдельный.
//
// Снимки с 18.09 загружает он сам — решение изменено, размен назван в
// контракте прямо: модерации в пробе нет. Держится запрет на чужие работы
// теперь на строке под блоком и на том, что мастерских семь и все знакомы
// лично. На проде сюда встаёт модерация.
import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { CategoryIcon } from '../../components/CategoryIcon'
import { Box, CheckRows, ChoiceRows } from '../../components/Choice'
import { MasterListCard } from '../../components/MasterListCard'
import { MasterShell } from '../../components/MasterShell'
import { ServiceIcon } from '../../components/ServiceIcon'
import { CameraIcon, CloseIcon } from '../../components/icons'
import {
  blockRow,
  blockRowDivider,
  buttonFilled,
  buttonText,
  chip,
  errorTextClass,
  field,
  fieldLabel,
  hintText,
  panel,
} from '../../components/ui'
import {
  CARD_LIMITS,
  DayTime,
  MASTER_SERVICES,
  PHOTO_MIME,
  Phone,
  type CategoryId,
  type MasterCardPublic,
  type MasterPhoto,
  type MasterSession,
  type Messenger,
  type MyCard,
  type ServiceOffer,
  type WeekDay,
} from '../../contract'
import { categories, cityName } from '../../questions/categories'
import { doesSuggestions, extrasSuggestions, serviceText } from '../../questions/services'
import { errorText, validationUnmapped } from '../../texts/request'
import { profilePage } from '../../texts/master'
import { readSession } from './session'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; card: MyCard }
  | { kind: 'failed'; message: string }

/** Дни недели строками: чипсами их нельзя — в группе семь значений, а § Components разрешает пять. */
const WEEK: readonly { id: WeekDay; label: string }[] = [
  { id: 'mon', label: 'Понедельник' },
  { id: 'tue', label: 'Вторник' },
  { id: 'wed', label: 'Среда' },
  { id: 'thu', label: 'Четверг' },
  { id: 'fri', label: 'Пятница' },
  { id: 'sat', label: 'Суббота' },
  { id: 'sun', label: 'Воскресенье' },
]

const MESSENGERS: readonly { id: Messenger; label: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'telegram', label: 'Telegram' },
]

/**
 * Услуги глазами мебельщика: «Выезжаю на замер», а не «Замер на месте».
 * Подсказка заказчика («Приедет и померит сам») здесь не показывается —
 * она написана про него в третьем лице, и рядом с «выезжаю» читается как
 * речь двух разных людей.
 */
const SERVICE_ROWS = MASTER_SERVICES.map((id) => ({ id, label: serviceText(id).ownLabel }))

const PHOTO_KINDS = categories.map((category) => ({ id: category.id, label: category.label }))

/** Те же четыре категории, что у заявки: по ним заказчик и отбирает. */
const CATEGORY_ROWS = categories.map((category) => ({
  id: category.id,
  label: category.label,
  hint: category.hint,
}))

/**
 * Пределы берутся из контракта, а не повторяются числами: разойдясь,
 * экран пустил бы шестой пункт, который схема отвергнет уже на отправке.
 */
const EXTRAS_MAX = CARD_LIMITS.extras
const PHOTOS_MAX = CARD_LIMITS.photos
const EXTRA_MAX_CHARS = CARD_LIMITS.extraChars
const ABOUT_MAX_CHARS = CARD_LIMITS.aboutChars
const CAPTION_MAX_CHARS = CARD_LIMITS.captionChars
const AREA_MAX_CHARS = CARD_LIMITS.serviceAreaChars

/** Поля, у которых есть своё сообщение об ошибке под ним. */
type ErrorField =
  | 'about'
  | 'years'
  | 'does'
  | 'categories'
  | 'services'
  | 'extras'
  | 'photos'
  | 'warranty'
  | 'lead'
  | 'hours'
  | 'phone'
  | 'area'

interface Draft {
  about: string
  years: string
  /** Направления одной строкой через запятую: их до шести, и это не список форм. */
  does: string
  categories: CategoryId[]
  services: ServiceOffer[]
  area: string
  extras: string[]
  photos: MasterPhoto[]
  logo: string | null
  warranty: string
  leadFrom: string
  leadTo: string
  days: WeekDay[]
  hoursFrom: string
  hoursTo: string
  phone: string
  messengers: Messenger[]
}

const EMPTY: Draft = {
  about: '',
  years: '',
  does: '',
  categories: [],
  services: [],
  area: '',
  extras: [],
  photos: [],
  logo: null,
  warranty: '',
  leadFrom: '',
  leadTo: '',
  days: [],
  hoursFrom: '',
  hoursTo: '',
  phone: '',
  messengers: [],
}

/** Заголовок раздела — над плашкой, а не внутри неё (чек-лист, п. 1). */
function Part({ title, hint, children }: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-3xl">
      <h2 className="text-subheading tracking-subheading font-medium">{title}</h2>
      {hint !== undefined && <p className={`mt-xs max-w-measure ${hintText}`}>{hint}</p>}
      <div className={`mt-md ${panel}`}>{children}</div>
    </section>
  )
}

/**
 * Часы как их набирают: цифры, двоеточие подставляется само. «Мягко
 * принимать» (§ Принципы) — человек не должен ставить разделитель руками,
 * но и формат угадывать за него мы не станем: 24 часа, как в карточке.
 */
function clockMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

function toggle<T>(list: readonly T[], id: T): T[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

export default function MasterProfileEdit() {
  const [session] = useState<MasterSession | null>(() => readSession())
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [draft, setDraft] = useState<Draft>(EMPTY)
  /**
   * Ключи ошибок перечислены, а не строкой: опечатка в `found.warrenty`
   * молча не показала бы человеку ничего, и поймать это можно было бы
   * только руками.
   */
  const [errors, setErrors] = useState<Partial<Record<ErrorField, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const photoPicker = useRef<HTMLInputElement>(null)
  const logoPicker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (session === null) return
    api.getMyCard(session.token).then(
      (card) => {
        setView({ kind: 'ready', card })
        if (card.card !== null) {
          const it = card.card
          setDraft({
            about: it.about,
            years: String(it.yearsOnMarket),
            does: it.does.join(', '),
            categories: [...it.categories],
            services: it.services.map((service) => ({ ...service })),
            area: it.serviceArea ?? '',
            extras: [...it.extras],
            photos: [...it.photos],
            logo: it.logo,
            warranty: it.warrantyMonths === null ? '' : String(it.warrantyMonths),
            leadFrom: it.leadTime === null ? '' : String(it.leadTime.min),
            leadTo: it.leadTime === null ? '' : String(it.leadTime.max),
            days: it.hours === null ? [] : [...it.hours.days],
            hoursFrom: it.hours?.from ?? '',
            hoursTo: it.hours?.to ?? '',
            phone: it.contactPhone ?? '',
            messengers: [...it.messengers],
          })
        }
      },
      (error: unknown) =>
        setView({
          kind: 'failed',
          message: isApiError(error) ? errorText[error.code] : profilePage.failedTitle,
        }),
    )
  }, [session, attempt])

  if (session === null) return <Navigate to="/master" replace />

  if (view.kind === 'loading') {
    return (
      <MasterShell masterName={session.master.name}>
        <p className="text-body tracking-body" role="status">
          {profilePage.loading}
        </p>
      </MasterShell>
    )
  }

  if (view.kind === 'failed') {
    return (
      <MasterShell masterName={session.master.name}>
        <h1 className="text-heading tracking-heading font-semibold">{profilePage.failedTitle}</h1>
        <p className="mt-lg max-w-measure text-body tracking-body">{view.message}</p>
        <button
          type="button"
          className={`mt-xl ${buttonFilled}`}
          onClick={() => {
            setView({ kind: 'loading' })
            setAttempt((n) => n + 1)
          }}
        >
          {profilePage.retry}
        </button>
      </MasterShell>
    )
  }

  const { card } = view

  function set(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setSaved(false)
  }

  /** Направления из строки: пустые куски отбрасываются, порядок сохраняется. */
  function parseDoes(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '')
  }

  async function addPhotos(files: FileList | null) {
    if (files === null || files.length === 0) return
    setPhotoError(null)
    const room = PHOTOS_MAX - draft.photos.length
    const taken = [...files].slice(0, room)
    if (files.length > room) setPhotoError(profilePage.errorPhotosMany)
    for (const file of taken) {
      try {
        const photo = await api.uploadPhoto(file)
        // Вид снимка мебельщик ставит сам: угадывать по имени файла нечем,
        // а угаданное неверно он же и не заметит.
        setDraft((current) => ({
          ...current,
          photos: [
            ...current.photos,
            { url: photo.url, kind: 'kitchen', caption: null, isRender: false },
          ],
        }))
        setSaved(false)
      } catch (caught: unknown) {
        setPhotoError(isApiError(caught) ? errorText[caught.code] : errorText.NETWORK)
      }
    }
  }

  async function addLogo(files: FileList | null) {
    if (files === null || files[0] === undefined) return
    setPhotoError(null)
    try {
      const photo = await api.uploadPhoto(files[0])
      set({ logo: photo.url })
    } catch (caught: unknown) {
      setPhotoError(isApiError(caught) ? errorText[caught.code] : errorText.NETWORK)
    }
  }

  /**
   * Ошибки схемы с сервера — по полям, а не одной строкой. Пока разбора
   * не было, любое расхождение показывалось как «заявка не прошла проверку»,
   * и человек искал вслепую по восьми блокам карточки.
   *
   * Путей здесь одиннадцать; всё остальное — поле, которого на экране ещё нет, —
   * честно называется в общей строке, а не прячется.
   */
  function fromServerFields(details: unknown): {
    found: Partial<Record<ErrorField, string>>
    unmapped: string[]
  } {
    const fields = (details as { fields?: { path: string; message: string }[] } | undefined)?.fields
    const found: Partial<Record<ErrorField, string>> = {}
    const unmapped: string[] = []
    for (const field of fields ?? []) {
      if (field.path.startsWith('about')) found.about = profilePage.errorAboutLong
      else if (field.path.startsWith('yearsOnMarket')) found.years = profilePage.errorYears
      else if (field.path.startsWith('does')) found.does = profilePage.errorDoesEmpty
      else if (field.path.startsWith('services')) found.services = profilePage.errorServices
      else if (field.path.startsWith('serviceArea')) found.area = profilePage.errorAreaLong
      else if (field.path.startsWith('extras')) found.extras = profilePage.errorExtrasLong
      else if (field.path.startsWith('photos')) found.photos = profilePage.errorCaptionLong
      else if (field.path.startsWith('warrantyMonths')) found.warranty = profilePage.errorWarranty
      else if (field.path.startsWith('leadTime')) found.lead = profilePage.errorLead
      else if (field.path.startsWith('hours')) found.hours = profilePage.errorHoursFormat
      else if (field.path.startsWith('contactPhone')) found.phone = profilePage.errorPhone
      else unmapped.push(field.path)
    }
    return { found, unmapped }
  }

  function validate(): boolean {
    const found: Partial<Record<ErrorField, string>> = {}
    if (draft.about.trim() === '') found.about = profilePage.errorAboutEmpty

    const does = parseDoes(draft.does)
    if (does.length === 0) found.does = profilePage.errorDoesEmpty
    else if (does.length > 6) found.does = profilePage.errorDoesMany

    const years = Number(draft.years)
    if (draft.years.trim() === '' || !Number.isInteger(years) || years < 0) {
      found.years = profilePage.errorYears
    }

    if (draft.categories.length === 0) found.categories = profilePage.errorCategoriesEmpty

    if (draft.photos.length === 0) found.photos = profilePage.errorPhotosEmpty

    // Пустой пункт молча исчезал при сохранении: человек добавил строку,
    // не заполнил, и она пропадала без объяснения.
    if (draft.extras.some((item) => item.trim() === '')) found.extras = profilePage.errorExtrasEmpty
    else if (draft.extras.some((item) => item.trim().length > EXTRA_MAX_CHARS)) {
      found.extras = profilePage.errorExtrasLong
    }

    if (draft.about.trim().length > ABOUT_MAX_CHARS) found.about = profilePage.errorAboutLong

    if (draft.area.trim().length > AREA_MAX_CHARS) found.area = profilePage.errorAreaLong

    if (draft.photos.some((photo) => (photo.caption ?? '').trim().length > CAPTION_MAX_CHARS)) {
      found.photos = profilePage.errorCaptionLong
    }

    if (draft.warranty.trim() !== '') {
      const months = Number(draft.warranty)
      if (!Number.isInteger(months) || months < 0 || months > CARD_LIMITS.warrantyMonths) {
        found.warranty = profilePage.errorWarranty
      }
    }

    // Срок называется вилкой целиком или не называется вовсе: одна граница
    // из двух — это не «почти заполнено», а непроверяемое обещание.
    const from = Number(draft.leadFrom)
    const to = Number(draft.leadTo)
    const leadFilled = draft.leadFrom.trim() !== '' || draft.leadTo.trim() !== ''
    if (leadFilled) {
      const bad =
        !Number.isInteger(from) || !Number.isInteger(to) ||
        from < 1 || to < 1 || from > CARD_LIMITS.leadDays || to > CARD_LIMITS.leadDays || from > to
      if (bad) found.lead = profilePage.errorLead
    }

    const hoursFilled = draft.days.length > 0 || draft.hoursFrom !== '' || draft.hoursTo !== ''
    if (hoursFilled) {
      // Часы проверяются тем же выражением, что и схема контракта: «25:70»
      // проходило сравнение строк `from < to` и падало уже на отправке —
      // общей ошибкой, по которой непонятно, какое поле чинить.
      const wellFormed =
        DayTime.safeParse(draft.hoursFrom).success && DayTime.safeParse(draft.hoursTo).success
      if (draft.days.length === 0) found.hours = profilePage.errorHoursDays
      else if (draft.hoursFrom === '' || draft.hoursTo === '') found.hours = profilePage.errorHoursOrder
      else if (!wellFormed) found.hours = profilePage.errorHoursFormat
      else if (draft.hoursFrom >= draft.hoursTo) found.hours = profilePage.errorHoursOrder
    }

    if (draft.phone.trim() !== '' && !Phone.safeParse(draft.phone.trim()).success) {
      found.phone = profilePage.errorPhone
    }

    setErrors(found)
    return Object.keys(found).length === 0
  }

  /**
   * Карточка каталога из черновика — ровно та, что увидит заказчик.
   * Собирается из незаписанных ещё полей: иначе предпросмотр показывал бы
   * сохранённое прошлое, а правится настоящее.
   *
   * Заглушки на месте пустых обязательных полей стоят только здесь: карточка
   * без названия в каталог не попадает, а предпросмотр обязан отрисоваться
   * даже у наполовину заполненного черновика.
   */
  const preview: MasterCardPublic = {
    id: session.master.id,
    name: card.name,
    city: card.city,
    card: {
      about: draft.about,
      yearsOnMarket: Number(draft.years) || 0,
      does: parseDoes(draft.does),
      categories: draft.categories,
      services: draft.services,
      serviceArea: draft.area.trim() === '' ? null : draft.area.trim(),
      extras: draft.extras.map((item) => item.trim()).filter((item) => item !== ''),
      photos: draft.photos,
      logo: draft.logo,
      warrantyMonths: draft.warranty.trim() === '' ? null : Number(draft.warranty),
      leadTime:
        draft.leadFrom.trim() !== '' && draft.leadTo.trim() !== ''
          ? { min: Number(draft.leadFrom), max: Number(draft.leadTo) }
          : null,
      hours:
        draft.days.length > 0 && draft.hoursFrom !== '' && draft.hoursTo !== ''
          ? { days: draft.days, from: draft.hoursFrom, to: draft.hoursTo }
          : null,
      // Контакта и мессенджеров в публичной проекции нет вовсе (контракт §2),
      // поэтому предпросмотр их и не показывает — он обязан совпадать
      // с каталогом до строчки, иначе перестаёт быть предпросмотром.
      publishedAt: card.card?.publishedAt ?? new Date().toISOString(),
    },
  }

  /**
   * Чего не хватает — делами, а не процентом. Порядок от того, что сильнее
   * мешает выбрать эту мастерскую: без снимков карточки нет вовсе, без услуг
   * её не с чем сравнить, дальше — вопросы, которые задают по очереди.
   */
  const kinds = new Set(draft.photos.map((photo) => photo.kind))
  const gaps = [
    draft.photos.length === 0 ? profilePage.gapPhotos : null,
    draft.photos.length > 0 && kinds.size === 1 ? profilePage.gapPhotoKinds : null,
    draft.services.length === 0 ? profilePage.gapServices : null,
    draft.warranty.trim() === '' ? profilePage.gapWarranty : null,
    draft.leadFrom.trim() === '' || draft.leadTo.trim() === '' ? profilePage.gapLead : null,
    draft.days.length === 0 ? profilePage.gapHours : null,
    draft.extras.length === 0 ? profilePage.gapExtras : null,
    draft.area.trim() === '' ? profilePage.gapArea : null,
  ].filter((item) => item !== null)

  function save() {
    if (!validate() || session === null) return
    setSaving(true)
    setSaved(false)
    setSendError(null)

    const leadFilled = draft.leadFrom.trim() !== '' && draft.leadTo.trim() !== ''
    const hoursFilled = draft.days.length > 0 && draft.hoursFrom !== '' && draft.hoursTo !== ''

    api
      .updateMyCard(session.token, {
        about: draft.about.trim(),
        yearsOnMarket: Number(draft.years),
        does: parseDoes(draft.does),
        categories: draft.categories,
        services: draft.services,
        serviceArea: draft.area.trim() === '' ? null : draft.area.trim(),
        extras: draft.extras.map((item) => item.trim()).filter((item) => item !== ''),
        photos: draft.photos,
        logo: draft.logo,
        warrantyMonths: draft.warranty.trim() === '' ? null : Number(draft.warranty),
        leadTime: leadFilled ? { min: Number(draft.leadFrom), max: Number(draft.leadTo) } : null,
        hours: hoursFilled
          ? { days: draft.days, from: draft.hoursFrom, to: draft.hoursTo }
          : null,
        contactPhone: draft.phone.trim() === '' ? null : draft.phone.trim(),
        messengers: draft.messengers,
      })
      .then(
        (updated) => {
          setSaving(false)
          setSaved(true)
          setView({ kind: 'ready', card: updated })
        },
        (error: unknown) => {
          setSaving(false)
          if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
            const { found, unmapped } = fromServerFields(error.details)
            setErrors(found)
            // Молчать про то, что экран не разложил, нельзя: «проверьте
            // отмеченные поля» при ничем не отмеченных полях отправляет
            // человека искать то, чего на экране нет (так же в форме заявки).
            setSendError(
              Object.keys(found).length === 0 || unmapped.length > 0
                ? validationUnmapped(unmapped)
                : null,
            )
            return
          }
          setSendError(isApiError(error) ? errorText[error.code] : errorText.NETWORK)
        },
      )
  }

  return (
    <MasterShell masterName={session.master.name}>
      <p className={hintText}>{profilePage.label}</p>
      <h1 className="mt-xs max-w-measure-title text-heading tracking-heading font-semibold">
        {profilePage.title}
      </h1>
      <p className="mt-lg max-w-measure text-body tracking-body">{profilePage.lede}</p>

      {/* Что заведено нами и не правится отсюда. Стоит первым, чтобы вопрос
          «а где поменять город» не возникал посреди формы. */}
      <div className={`mt-3xl ${panel}`}>
        <p className={fieldLabel}>{profilePage.nameLabel}</p>
        <p className="mt-xs text-body tracking-body">{card.name}</p>
        <p className={`mt-lg ${fieldLabel}`}>{profilePage.cityLabel}</p>
        <p className="mt-xs text-body tracking-body">{cityName(card.city)}</p>
        <p className={`mt-lg max-w-measure ${hintText}`}>{profilePage.fixedNote}</p>
      </div>

      {card.card === null ? (
        // Карточки ещё нет — законное состояние, а не ошибка: приём заявок
        // и публикация в каталоге разные решения (контракт §2).
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{profilePage.emptyTitle}</h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{profilePage.emptyBody}</p>
        </section>
      ) : (
        <>
          <Part title={profilePage.aboutLabel} hint={profilePage.aboutHint}>
            {/* Метки у поля нет: её слово в слово произносит заголовок
                раздела над плашкой, а дубль человек читает как две разные
                вещи и ищет между ними разницу (чек-лист, п. 3). */}
            <textarea id="about" rows={4} value={draft.about}
              aria-label={profilePage.aboutLabel}
              onChange={(event) => set({ about: event.target.value })}
              placeholder={profilePage.aboutPlaceholder}
              aria-invalid={errors.about !== undefined}
              className={`block w-full ${field(errors.about !== undefined)}`} />
            {errors.about !== undefined && <p className={`mt-xs ${errorTextClass}`}>{errors.about}</p>}

            <label className="mt-xl block" htmlFor="years">
              <span className={fieldLabel}>{profilePage.yearsLabel}</span>
              <input id="years" inputMode="numeric" value={draft.years}
                onChange={(event) => set({ years: event.target.value.replace(/\D/g, '').slice(0, 2) })}
                placeholder="12"
                aria-invalid={errors.years !== undefined}
                className={`mt-sm block w-[10rem] tabular-nums ${field(errors.years !== undefined)}`} />
            </label>
            {errors.years !== undefined && <p className={`mt-xs ${errorTextClass}`}>{errors.years}</p>}

            {/* Отбор и показ — рядом, но порознь: по отметкам мастерскую
                находят в каталоге, строкой ниже она называет себя своими
                словами. Раньше отбор шёл по видам снимков, и мастерская,
                которая делает ванные, но не сняла их, выпадала. */}
            <p className={`mt-xl ${fieldLabel}`}>{profilePage.categoriesLabel}</p>
            <p className={`mt-xs max-w-measure ${hintText}`}>{profilePage.categoriesHint}</p>
            <div className="mt-sm">
              <CheckRows options={CATEGORY_ROWS} chosen={draft.categories}
                icon={(id) => <CategoryIcon id={id} />}
                onToggle={(id) => set({ categories: toggle(draft.categories, id) })} />
            </div>
            {errors.categories !== undefined && (
              <p className={`mt-xs ${errorTextClass}`}>{errors.categories}</p>
            )}

            <label className="mt-xl block" htmlFor="does">
              <span className={fieldLabel}>{profilePage.doesLabel}</span>
              <input id="does" value={draft.does}
                onChange={(event) => set({ does: event.target.value })}
                placeholder={profilePage.doesPlaceholder}
                aria-invalid={errors.does !== undefined}
                className={`mt-sm block w-full ${field(errors.does !== undefined)}`} />
            </label>
            {errors.does !== undefined ? (
              <p className={`mt-xs ${errorTextClass}`}>{errors.does}</p>
            ) : (
              <p className={`mt-xs max-w-measure ${hintText}`}>{profilePage.doesHint}</p>
            )}

            {/* Подсказки-направления: нажатие дописывает, а не заменяет —
                мастерская называет себя своими словами, наш список только
                напоминает, что ещё бывает. */}
            <ul className="mt-md flex flex-wrap gap-sm">
              {doesSuggestions
                .filter((item) => !parseDoes(draft.does).includes(item))
                .map((item) => (
                  <li key={item}>
                    <button type="button" className={chip(false)}
                      onClick={() => set({ does: [...parseDoes(draft.does), item].join(', ') })}>
                      {item}
                    </button>
                  </li>
                ))}
            </ul>

            {/* Показ «как это прочтётся в каталоге» отсюда убран: ниже стоит
                предпросмотр всей карточки, и направления в нём уже видно.
                Одно и то же, сказанное дважды, человек читает как две разные
                вещи и ищет между ними разницу (чек-лист, п. 3). */}
          </Part>

          {/* Услуги — закрытый список: под каждую нарисован знак (контракт §2).
              У отмеченной спрашивается условие: без него два одинаковых
              списка несравнимы (бенчмарк 18.09). */}
          <Part title={profilePage.servicesLabel} hint={profilePage.servicesHint}>
            <div className="-mx-md">
              {SERVICE_ROWS.map((row) => {
                const chosen = draft.services.find((service) => service.id === row.id)
                return (
                  <div key={row.id} className={blockRowDivider}>
                    <label className={blockRow(chosen !== undefined)}>
                      <input type="checkbox" className="sr-only" checked={chosen !== undefined}
                        onChange={() =>
                          set({
                            services:
                              chosen === undefined
                                ? [...draft.services, { id: row.id, paid: false }]
                                : draft.services.filter((service) => service.id !== row.id),
                          })
                        } />
                      <ServiceIcon id={row.id} />
                      <span className="min-w-0">
                        <span className="block group-hover:underline underline-offset-4">
                          {row.label}
                        </span>
                      </span>
                      <Box on={chosen !== undefined} />
                    </label>

                    {/* Условие — двумя чипсами, а не тумблером: тумблер
                        не говорит, что значит «выключено» (§ Components).
                        Два значения по 18 знаков — ровно случай чипса. */}
                    {chosen !== undefined && (
                      // Группа названа услугой: без имени экранный диктор
                      // читает «В цене» и «Отдельно» без указания, к чему
                      // они относятся, — а таких пар на экране до восьми.
                      <div role="group" aria-label={row.label}
                        className="flex flex-wrap gap-sm px-md pb-md">
                        {[false, true].map((paid) => (
                          <label key={String(paid)} className={chip(chosen.paid === paid)}>
                            <input type="radio" className="sr-only"
                              name={`service-${row.id}`} checked={chosen.paid === paid}
                              onChange={() =>
                                set({
                                  services: draft.services.map((service) =>
                                    service.id === row.id ? { ...service, paid } : service,
                                  ),
                                })
                              } />
                            {paid ? profilePage.servicePaid : profilePage.serviceIncluded}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {errors.services !== undefined && (
              <p className={`mt-md ${errorTextClass}`}>{errors.services}</p>
            )}
          </Part>

          {/* Куда выезжают. Свой город известен и так — здесь пригород. */}
          <Part title={profilePage.areaLabel} hint={profilePage.areaHint}>
            <input value={draft.area}
              aria-label={profilePage.areaLabel}
              placeholder={profilePage.areaPlaceholder}
              onChange={(event) => set({ area: event.target.value })}
              aria-invalid={errors.area !== undefined}
              className={`block w-full max-w-measure ${field(errors.area !== undefined)}`} />
            {errors.area !== undefined && <p className={`mt-xs ${errorTextClass}`}>{errors.area}</p>}
          </Part>

          {/* Отличия своими словами. По строке на пункт, а не одним полем
              через запятую: пункты показываются списком, и запятая внутри
              фразы разорвала бы её посередине. */}
          <Part title={profilePage.extrasLabel} hint={profilePage.extrasHint}>
            {draft.extras.map((item, index) => (
              <div key={index} className={`flex items-start gap-sm ${index > 0 ? 'mt-md' : ''}`}>
                {/* Поле на две строки, а не однострочное: пункт длиной
                    до 80 знаков в строку не влезает, и мебельщик не видит
                    конца собственной фразы. */}
                <textarea value={item} rows={2}
                  aria-label={`${profilePage.extrasLabel}, ${index + 1}`}
                  placeholder={profilePage.extrasPlaceholder}
                  onChange={(event) => {
                    const next = [...draft.extras]
                    next[index] = event.target.value
                    set({ extras: next })
                  }}
                  className={`block w-full resize-none ${field(false)}`} />
                <button type="button" className={buttonText}
                  aria-label={profilePage.extrasRemove}
                  onClick={() => set({ extras: draft.extras.filter((_, at) => at !== index) })}>
                  <CloseIcon />
                </button>
              </div>
            ))}
            {errors.extras !== undefined && <p className={`mt-xs ${errorTextClass}`}>{errors.extras}</p>}

            {draft.extras.length < EXTRAS_MAX && (
              <button type="button" className={`${draft.extras.length > 0 ? 'mt-md' : ''} ${buttonText}`}
                onClick={() => set({ extras: [...draft.extras, ''] })}>
                {profilePage.extrasAdd}
              </button>
            )}

            {/* Примеры — текстом, а не чипсами. Чипс в системе держит
                значение не длиннее 22 знаков (§ Components), а «Подгоняем
                по месту после ремонта» — 32: группа развалилась бы в столбик
                с рваным краем. И это не выбор из списка: мебельщик пишет
                своё, а примеры показывают, какого рода фраза сюда годится. */}
            <p className={`mt-lg ${hintText}`}>{profilePage.extrasExamples}</p>
            <ul className={`mt-sm max-w-measure ${hintText}`}>
              {extrasSuggestions.map((item) => (
                <li key={item} className="mt-xs first:mt-0">{item}</li>
              ))}
            </ul>
          </Part>

          {/* Гарантия и срок — один раздел: это одно обещание, названное
              двумя числами, и порознь они читались бы как два требования. */}
          <Part title={profilePage.termsLabel} hint={profilePage.termsHint}>
            <p className={fieldLabel}>{profilePage.warrantyLabel}</p>
            <input id="warranty" inputMode="numeric" value={draft.warranty}
              aria-label={profilePage.warrantyLabel}
              onChange={(event) => set({ warranty: event.target.value.replace(/\D/g, '').slice(0, 3) })}
              placeholder="24"
              aria-invalid={errors.warranty !== undefined}
              className={`mt-sm block w-[10rem] tabular-nums ${field(errors.warranty !== undefined)}`} />
            {errors.warranty !== undefined && (
              <p className={`mt-xs ${errorTextClass}`}>{errors.warranty}</p>
            )}

            <p className={`mt-xl ${fieldLabel}`}>{profilePage.leadLabel}</p>
            <p className={`mt-xs max-w-measure ${hintText}`}>{profilePage.leadHint}</p>
            {/* Пара «подпись + поле» переносится целиком, а не по частям:
                на 375px две пары в строку не встают, и без обёртки «до»
                остаётся в первой строке, а его поле уезжает во вторую. */}
            <div className="mt-sm flex flex-wrap items-baseline gap-x-lg gap-y-md">
              <span className="flex items-baseline gap-sm">
                <span className={hintText}>{profilePage.leadFrom}</span>
                <input inputMode="numeric" value={draft.leadFrom}
                  aria-label={`${profilePage.leadLabel}, ${profilePage.leadFrom}`}
                  onChange={(event) => set({ leadFrom: event.target.value.replace(/\D/g, '').slice(0, 3) })}
                  placeholder="25"
                  aria-invalid={errors.lead !== undefined}
                  className={`w-[10rem] tabular-nums ${field(errors.lead !== undefined)}`} />
              </span>
              <span className="flex items-baseline gap-sm">
                <span className={hintText}>{profilePage.leadTo}</span>
                <input inputMode="numeric" value={draft.leadTo}
                  aria-label={`${profilePage.leadLabel}, ${profilePage.leadTo}`}
                  onChange={(event) => set({ leadTo: event.target.value.replace(/\D/g, '').slice(0, 3) })}
                  placeholder="35"
                  aria-invalid={errors.lead !== undefined}
                  className={`w-[10rem] tabular-nums ${field(errors.lead !== undefined)}`} />
              </span>
            </div>
            {errors.lead !== undefined && <p className={`mt-xs ${errorTextClass}`}>{errors.lead}</p>}
          </Part>

          <Part title={profilePage.hoursLabel} hint={profilePage.hoursHint}>
            <CheckRows options={WEEK} chosen={draft.days}
              onToggle={(id) => set({ days: toggle(draft.days, id) })} />

            {/* Часы — своим полем, а не type="time". Нативное поле рисуется
                по локали браузера: на английской раскладке оно показывает
                «07:00 PM» капсом, которого система не допускает вовсе,
                а карточка тут же показывает те же часы как «10:00–19:00».
                Два формата на одни данные — хуже, чем ручной ввод. */}
            <div className="mt-lg flex flex-wrap items-baseline gap-x-lg gap-y-md">
              <span className="flex items-baseline gap-sm">
                <span className={hintText}>{profilePage.hoursFrom}</span>
                <input inputMode="numeric" value={draft.hoursFrom} placeholder="10:00"
                  aria-label={`${profilePage.hoursLabel}, ${profilePage.hoursFrom}`}
                  onChange={(event) => set({ hoursFrom: clockMask(event.target.value) })}
                  aria-invalid={errors.hours !== undefined}
                  className={`w-[10rem] tabular-nums ${field(errors.hours !== undefined)}`} />
              </span>
              <span className="flex items-baseline gap-sm">
                <span className={hintText}>{profilePage.hoursTo}</span>
                <input inputMode="numeric" value={draft.hoursTo} placeholder="19:00"
                  aria-label={`${profilePage.hoursLabel}, ${profilePage.hoursTo}`}
                  onChange={(event) => set({ hoursTo: clockMask(event.target.value) })}
                  aria-invalid={errors.hours !== undefined}
                  className={`w-[10rem] tabular-nums ${field(errors.hours !== undefined)}`} />
              </span>
            </div>
            {errors.hours !== undefined && <p className={`mt-xs ${errorTextClass}`}>{errors.hours}</p>}
          </Part>

          <Part title={profilePage.contactLabel} hint={profilePage.contactHint}>
            <input id="contact-phone" inputMode="tel" value={draft.phone}
              aria-label={profilePage.contactLabel}
              onChange={(event) => set({ phone: event.target.value })}
              placeholder="+77010000000"
              aria-invalid={errors.phone !== undefined}
              className={`block w-[20rem] max-w-full tabular-nums ${field(errors.phone !== undefined)}`} />
            {errors.phone !== undefined && <p className={`mt-xs ${errorTextClass}`}>{errors.phone}</p>}

            <p className={`mt-xl ${fieldLabel}`}>{profilePage.messengersLabel}</p>
            <div className="mt-sm">
              <CheckRows options={MESSENGERS} chosen={draft.messengers}
                onToggle={(id) => set({ messengers: toggle(draft.messengers, id) })} />
            </div>
          </Part>

          {/* Работы. Свои, снятые у своих заказчиков: строка под блоком —
              единственное, что об этом теперь напоминает (контракт §5б). */}
          <Part title={profilePage.worksLabel} hint={profilePage.worksNote}>
            {draft.photos.length === 0 ? (
              <p className={`max-w-measure ${hintText}`}>{profilePage.worksEmpty}</p>
            ) : (
              // Снимок не кладётся во вложенную плашку: внутри него живут
              // строки выбора, а выбранная строка сама поднимается на второй
              // уровень — вместе это дало бы третий, который § Elevation
              // запрещает, и выбранное перестало бы отличаться фоном.
              <ul className="-mx-md">
                {draft.photos.map((photo, index) => (
                  <li key={photo.url}
                    className={`px-md py-lg ${index > 0 ? 'border-t border-outline' : ''}`}>
                    <div className="flex items-center gap-md">
                      <img src={photo.url} alt=""
                        className="aspect-[4/3] w-4xl shrink-0 bg-surface-container object-cover" />
                      <p className={`grow ${fieldLabel}`}>{profilePage.worksKindLabel}</p>
                      <button type="button" className={buttonText}
                        aria-label={`${profilePage.worksRemove}: ${index + 1}`}
                        onClick={() => set({ photos: draft.photos.filter((_, at) => at !== index) })}>
                        <CloseIcon />
                      </button>
                    </div>

                    {/* Вид работы — на всю ширину, а не рядом со снимком:
                        в колонке шириной в треть экрана «Шкаф и гардеробная»
                        ломается на три строки. */}
                    <div className="mt-sm">
                      <ChoiceRows name={`photo-kind-${index}`} options={PHOTO_KINDS}
                        value={photo.kind}
                        onPick={(kind: CategoryId) => {
                          const next = [...draft.photos]
                          next[index] = { ...photo, kind }
                          set({ photos: next })
                        }} />
                    </div>

                    <label className="mt-md block">
                      <span className={fieldLabel}>{profilePage.worksCaptionLabel}</span>
                      <input value={photo.caption ?? ''}
                        placeholder={profilePage.worksCaptionPlaceholder}
                        onChange={(event) => {
                          const next = [...draft.photos]
                          const caption = event.target.value.trim() === '' ? null : event.target.value
                          next[index] = { ...photo, caption }
                          set({ photos: next })
                        }}
                        className={`mt-sm block w-full ${field(false)}`} />
                    </label>

                    {/* Рисунок отмечается здесь, а не угадывается нами:
                        по рендеру заказчик судит о сборке, которой
                        на картинке нет (контракт §2). */}
                    <label className={`mt-md ${chip(photo.isRender)}`}>
                      <input type="checkbox" className="sr-only" checked={photo.isRender}
                        onChange={() => {
                          const next = [...draft.photos]
                          next[index] = { ...photo, isRender: !photo.isRender }
                          set({ photos: next })
                        }} />
                      {profilePage.worksRenderLabel}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {errors.photos !== undefined && <p className={`mt-md ${errorTextClass}`}>{errors.photos}</p>}

            <input ref={photoPicker} type="file" multiple className="sr-only"
              aria-label={profilePage.worksAdd} accept={PHOTO_MIME.join(',')}
              onChange={(event) => { void addPhotos(event.target.files); event.target.value = '' }} />
            {draft.photos.length < PHOTOS_MAX && (
              <button type="button" className={`mt-lg ${buttonText}`}
                onClick={() => photoPicker.current?.click()}>
                <CameraIcon />
                {profilePage.worksAdd}
              </button>
            )}
          </Part>

          <Part title={profilePage.logoLabel} hint={profilePage.logoHint}>
            {draft.logo !== null && (
              <img src={draft.logo} alt="" className="h-icon-lg w-auto" />
            )}
            <input ref={logoPicker} type="file" className="sr-only"
              aria-label={profilePage.logoAdd} accept={PHOTO_MIME.join(',')}
              onChange={(event) => { void addLogo(event.target.files); event.target.value = '' }} />
            <div className="mt-md flex flex-wrap gap-md">
              <button type="button" className={buttonText} onClick={() => logoPicker.current?.click()}>
                {profilePage.logoAdd}
              </button>
              {draft.logo !== null && (
                <button type="button" className={buttonText} onClick={() => set({ logo: null })}>
                  {profilePage.logoRemove}
                </button>
              )}
            </div>
          </Part>

          {/* Предпросмотр и пропуски. Из бенчмарка (18.09): продавец правит
              карточку вслепую, пока не увидит себя глазами покупателя,
              а «профиль заполнен на 68%» не говорит, что делать. */}
          <section className="mt-3xl">
            <h2 className="text-subheading tracking-subheading font-medium">
              {profilePage.previewTitle}
            </h2>
            <p className={`mt-xs max-w-measure ${hintText}`}>{profilePage.previewHint}</p>
            <div className="mt-md max-w-measure">
              <MasterListCard master={preview} asPreview />
            </div>
          </section>

          <section className="mt-3xl">
            <h2 className="text-subheading tracking-subheading font-medium">
              {profilePage.gapsTitle}
            </h2>
            {gaps.length === 0 ? (
              <p className="mt-md max-w-measure text-body tracking-body">{profilePage.gapsNone}</p>
            ) : (
              <ul className="mt-md max-w-measure">
                {gaps.map((gap) => (
                  <li key={gap} className="mt-sm text-body tracking-body first:mt-0">
                    {gap}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {photoError !== null && <p role="alert" className={`mt-xl ${errorTextClass}`}>{photoError}</p>}
          {sendError !== null && <p className={`mt-xl ${errorTextClass}`}>{sendError}</p>}
          {saved && <p className={`mt-xl ${hintText}`}>{profilePage.saved}</p>}

          {/* Главное действие в конце экрана (§ Порядок важнее полноты). */}
          <button type="button" onClick={save} disabled={saving} className={`mt-xl ${buttonFilled}`}>
            {saving ? profilePage.saving : profilePage.save}
          </button>
        </>
      )}
    </MasterShell>
  )
}

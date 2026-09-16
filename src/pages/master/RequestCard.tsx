// US-18 + US-19a — карточка заявки и ответ вилкой. Один экран, а не два:
// система против модалок и за стадии одной страницы (DESIGN.md § Layout),
// а мебельщик отвечает между цехом и замером — лишний переход теряет ответ.
//
// Телефон заказчицы появляется на экране только после отправки КП, и это
// не решение экрана: до ответа сервер его не присылает вовсе (контракт §7).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { MasterShell } from '../../components/MasterShell'
import { CategoryIcon } from '../../components/CategoryIcon'
import {
  badge,
  buttonFilled,
  errorTextClass,
  field,
  fieldLabel,
  hintText,
  link,
  panel,
  panelNested,
} from '../../components/ui'
import type { MasterSession, RequestForMaster } from '../../contract'
import {
  categories,
  city as cityQuestion,
  finishLevel,
  wardrobeDoors,
  kitchenAppliances,
  kitchenShape,
  metersUnit,
} from '../../questions/categories'
import { errorText } from '../../texts/request'
import { quotePage, requestsPage, routedAtLabel } from '../../texts/master'
import { clearSession, readSession } from './session'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; request: RequestForMaster }
  | { kind: 'foreign' }
  | { kind: 'failed'; message: string }

interface Draft {
  composition: string
  materials: string
  priceFrom: string
  priceTo: string
  leadTimeDays: string
}

const EMPTY: Draft = { composition: '', materials: '', priceFrom: '', priceTo: '', leadTimeDays: '' }

/** Ввод денег: в состоянии живут только цифры, пробелы — способ показа. */
/** Девять разрядов — миллиард тенге; больше в вилке за кухню не бывает. */
const MAX_PRICE_DIGITS = 9
const digits = (value: string, max = MAX_PRICE_DIGITS): string =>
  value.replace(/\D/g, '').slice(0, max)
const grouped = (value: string): string => (value === '' ? '' : Number(value).toLocaleString('ru-RU').replace(/ /g, ' '))

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-heading tracking-heading font-semibold">{children}</h1>
}

/**
 * Строка подробностей: метка сверху приглушённым, значение под ней, строки
 * делит линия. Две колонки с прижатым вправо значением на 375px ломались:
 * длинное значение переносилось под метку и вставало по левому краю, а
 * короткое оставалось справа — колонка прыгала. Метка над значением держит
 * один край на любой ширине, а расстояние между ними — 4, как между строкой
 * и её подписью (DESIGN.md § Layout).
 */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-outline py-md last:border-b-0">
      <p className={hintText}>{label}</p>
      <p className="mt-xs text-body tracking-body">{value}</p>
    </div>
  )
}

export default function RequestCard() {
  const { id } = useParams()
  const [session, setSession] = useState<MasterSession | null>(() => readSession())
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  /**
   * Под StrictMode эффект в деве исполняется дважды. Без этой отметки
   * getRequestForMaster писал бы два master_opened на одно открытие —
   * событие US-25b считалось бы вдвое; та же защита стоит у заказчицы
   * в Offers.tsx. Отметка ключуется заявкой и сессией, поэтому она же
   * отбрасывает устаревший ответ: при быстром переходе между заявками
   * ответ на прежний id не перезапишет новый экран.
   */
  const fetchedFor = useRef<string | null>(null)

  const load = useCallback((token: string, requestId: string) => {
    const key = `${token}|${requestId}`
    const current = () => fetchedFor.current === key
    fetchedFor.current = key

    api.getRequestForMaster(token, requestId).then(
      (request) => {
        if (current()) setView({ kind: 'ready', request })
      },
      (caught: unknown) => {
        if (!current()) return
        if (!isApiError(caught)) return setView({ kind: 'failed', message: errorText.INTERNAL })
        // Чужая заявка и несуществующая приходят одним кодом — так задумано
        // контрактом, чтобы id нельзя было перебирать на существование (§5б).
        if (caught.code === 'NOT_ROUTED_TO_YOU') return setView({ kind: 'foreign' })
        // Сессия протухла или отозвана — уводим на вход, а не оставляем
        // человека на сообщении, из которого выбираться приходится кружным
        // путём через «Все заявки».
        if (caught.code === 'MASTER_UNAUTHORIZED') {
          clearSession()
          return setSession(null)
        }
        setView({ kind: 'failed', message: errorText[caught.code] })
      },
    )
  }, [])

  useEffect(() => {
    if (!session || id === undefined) return
    if (fetchedFor.current === `${session.token}|${id}`) return
    load(session.token, id)
  }, [session, id, load])

  // Сессии нет — на вход, а не на объяснение, почему сюда нельзя (US-17).
  if (!session) return <Navigate to="/master" replace />
  if (id === undefined) return <Navigate to="/master/requests" replace />

  if (view.kind === 'loading') {
    return (
      <MasterShell masterName={session.master.name}>
        <p className="text-body tracking-body" role="status">
          {quotePage.loading}
        </p>
      </MasterShell>
    )
  }

  if (view.kind === 'foreign' || view.kind === 'failed') {
    const foreign = view.kind === 'foreign'
    return (
      <MasterShell masterName={session.master.name}>
        <Title>{foreign ? quotePage.foreignTitle : quotePage.failedTitle}</Title>
        <p className="mt-lg max-w-[58ch] text-body tracking-body">
          {foreign ? quotePage.foreignBody : view.message}
        </p>
        <p className="mt-xl">
          <Link to="/master/requests" className={link}>
            {quotePage.back}
          </Link>
        </p>
      </MasterShell>
    )
  }

  const { request } = view
  const category = categories.find((item) => item.id === request.details.category)
  const size = request.mainSize.known
    ? `${String(request.mainSize.meters).replace('.', ',')} ${metersUnit(request.mainSize.meters)}`
    : quotePage.sizeUnknownValue
  const cityName =
    request.city.name ??
    cityQuestion.options.find((option) => option.id === request.city.code)?.label ??
    ''

  const details: { label: string; value: string }[] = []
  details.push({ label: quotePage.sizeLabel, value: size })
  // Ветка кухни вытаскивается в переменную: union сужается по своему
  // дискриминанту, а не по пути через свойство заявки.
  const kitchen = request.details
  if (kitchen.category === 'wardrobe') {
    const doors = wardrobeDoors.options.find((option) => option.id === kitchen.doors)
    if (doors) details.push({ label: quotePage.doorsLabel, value: doors.label })
    if (kitchen.toCeiling !== null) {
      details.push({
        label: quotePage.ceilingLabel,
        value: kitchen.toCeiling ? quotePage.ceilingYes : quotePage.ceilingNo,
      })
    }
  }
  if (kitchen.category === 'kitchen') {
    const shape = kitchenShape.options.find((option) => option.id === kitchen.shape)
    const appliances = kitchenAppliances.options.find(
      (option) => option.id === kitchen.appliances,
    )
    if (shape) details.push({ label: quotePage.shapeLabel, value: shape.label })
    if (appliances) details.push({ label: quotePage.appliancesLabel, value: appliances.label })
  }
  details.push({
    label: quotePage.cityLabel,
    value: [cityName, request.district].filter(Boolean).join(', '),
  })
  details.push({ label: quotePage.deadlineLabel, value: request.deadline ?? quotePage.notSet })
  // Уровень отделки спрашивается с US-08. Поле необязательное: заказчица
  // могла его пропустить — тогда честное «не указан», а не прочерк.
  const finish = finishLevel.options.find((option) => option.id === request.finishLevel)
  details.push({ label: quotePage.finishLabel, value: finish?.label ?? quotePage.notSet })

  function validate(): boolean {
    const found: Partial<Record<keyof Draft, string>> = {}
    if (draft.composition.trim() === '') found.composition = quotePage.errorComposition
    if (draft.materials.trim() === '') found.materials = quotePage.errorMaterials
    if (draft.priceFrom === '' || draft.priceTo === '') found.priceFrom = quotePage.errorPriceEmpty
    else if (Number(draft.priceTo) < Number(draft.priceFrom))
      found.priceFrom = quotePage.errorPriceOrder
    if (draft.leadTimeDays === '' || Number(draft.leadTimeDays) <= 0)
      found.leadTimeDays = quotePage.errorLeadTime
    setErrors(found)
    return Object.keys(found).length === 0
  }

  function send() {
    if (!validate() || session === null || id === undefined) return
    setSending(true)
    setSendError(null)
    api
      .createQuote(session.token, id, {
        composition: draft.composition.trim(),
        materials: draft.materials.trim(),
        price: { minKzt: Number(draft.priceFrom), maxKzt: Number(draft.priceTo) },
        leadTimeDays: Number(draft.leadTimeDays),
      })
      .then(
        () => {
          // Перечитываем карточку, а не дорисовываем ответ на месте: вместе
          // с КП открывается телефон заказчицы, и источник у него один — сервер.
          setSending(false)
          setDraft(EMPTY)
          // Отметка сбрасывается: это осознанный повторный запрос, а не
          // повторный монтаж, и пропустить его нельзя — вместе с ответом
          // приходит телефон заказчицы.
          fetchedFor.current = null
          load(session.token, id)
        },
        (caught: unknown) => {
          setSending(false)
          if (!isApiError(caught)) return setSendError(errorText.INTERNAL)
          // Ответ уже есть — значит его отправили из другой вкладки. Показываем
          // то, что на сервере, вместо спора с ним.
          if (caught.code === 'QUOTE_ALREADY_SENT') {
            fetchedFor.current = null
            return load(session.token, id)
          }
          setSendError(errorText[caught.code])
        },
      )
  }

  return (
    <MasterShell masterName={session.master.name}>
      <p>
        <Link to="/master/requests" className={link}>
          {quotePage.back}
        </Link>
      </p>

      <p className={`mt-xl ${hintText}`}>
        {quotePage.numberLabel} {request.number} · {routedAtLabel(request.routedAt)}
      </p>
      <div className="mt-xs flex flex-wrap items-center gap-md">
        <CategoryIcon id={request.details.category} />
        <Title>
          {category?.label}, {size}
        </Title>
        {/* Шильдик у заголовка, а не в списке: открыв карточку, мебельщик
            сразу видит, что по этой заявке уже отвечал, — раздел с ответом
            лежит ниже и в первый экран не попадает. */}
        {request.myQuote && <span className={badge}>{requestsPage.answeredBadge}</span>}
      </div>

      {/* Своими словами — то, ради чего мебельщик открывает заявку. Плашки
          нет намеренно: абзац самостоятелен, а плашка вокруг самостоятельного
          элемента — шум (DESIGN.md § Elevation). */}
      <section className="mt-3xl">
        <h2 className="text-subheading tracking-subheading font-medium">
          {quotePage.describedTitle}
        </h2>
        <p className="mt-sm max-w-[62ch] text-body tracking-body">{request.description}</p>
      </section>

      <section className="mt-3xl">
        <h2 className="text-subheading tracking-subheading font-medium">
          {quotePage.detailsTitle}
        </h2>
        <div className={`mt-lg ${panel} py-sm`}>
          {details.map((row) => (
            <DetailRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      </section>

      <section className="mt-3xl">
        <h2 className="text-subheading tracking-subheading font-medium">
          {quotePage.photosTitle}
        </h2>
        {request.photos.length === 0 ? (
          <p className={`mt-sm max-w-[62ch] ${hintText}`}>{quotePage.noPhotos}</p>
        ) : (
          // Радиус 0: скруглённый угол на снимке отрезает предмет и уводит
          // масштаб (DESIGN.md § Shapes).
          <ul className="mt-lg grid grid-cols-2 gap-md sm:grid-cols-3">
            {request.photos.map((photo) => (
              <li key={photo.id}>
                <img src={photo.url} alt={photo.name} className="aspect-4/3 w-full object-cover" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {request.myQuote ? (
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">
            {quotePage.sentTitle}
          </h2>
          <p className="mt-sm max-w-[62ch] text-body tracking-body">{quotePage.sentBody}</p>

          <div className={`mt-lg ${panel}`}>
            <p className={fieldLabel}>{quotePage.clientPhoneLabel}</p>
            {/* Контакт открылся ответом. Ссылка, а не кнопка: это переход
                в телефон, а переходы в системе синие с подчёркиванием. */}
            <p className="mt-xs text-subheading tracking-subheading font-medium">
              {request.clientPhone && (
                <a href={`tel:${request.clientPhone}`} className={link}>
                  {request.clientPhone}
                </a>
              )}
            </p>

            <div className={`mt-xl ${panelNested}`}>
              <p className={fieldLabel}>{quotePage.yourQuoteTitle}</p>
              <p className="mt-sm text-body tracking-body tabular-nums">
                {quotePage.priceRange(
                  request.myQuote.price.minKzt,
                  request.myQuote.price.maxKzt,
                )}{' '}
                · {quotePage.leadTime(request.myQuote.leadTimeDays)}
              </p>
              <p className="mt-sm text-body-sm tracking-body-sm">{request.myQuote.composition}</p>
              <p className="mt-xs text-body-sm tracking-body-sm">{request.myQuote.materials}</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{quotePage.formTitle}</h2>
          <p className={`mt-sm max-w-[62ch] ${hintText}`}>{quotePage.formHint}</p>

          <div className={`mt-lg ${panel}`}>
            <label className="block" htmlFor="composition">
              <span className={fieldLabel}>{quotePage.compositionLabel}</span>
              <textarea
                id="composition"
                rows={3}
                value={draft.composition}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, composition: event.target.value }))
                }
                placeholder={quotePage.compositionPlaceholder}
                aria-invalid={errors.composition !== undefined}
                className={`mt-sm block w-full ${field(errors.composition !== undefined)}`}
              />
            </label>
            {errors.composition && <p className={`mt-xs ${errorTextClass}`}>{errors.composition}</p>}

            <label className="mt-xl block" htmlFor="materials">
              <span className={fieldLabel}>{quotePage.materialsLabel}</span>
              <textarea
                id="materials"
                rows={3}
                value={draft.materials}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, materials: event.target.value }))
                }
                placeholder={quotePage.materialsPlaceholder}
                aria-invalid={errors.materials !== undefined}
                className={`mt-sm block w-full ${field(errors.materials !== undefined)}`}
              />
            </label>
            {errors.materials ? (
              <p className={`mt-xs ${errorTextClass}`}>{errors.materials}</p>
            ) : (
              <p className={`mt-xs ${hintText}`}>{quotePage.materialsHint}</p>
            )}

            <fieldset className="mt-xl">
              <legend className={fieldLabel}>{quotePage.priceLabel}</legend>
              <div className="mt-sm flex flex-wrap items-center gap-md">
                <label className="flex items-center gap-sm" htmlFor="priceFrom">
                  <span className={hintText}>{quotePage.priceFrom}</span>
                  <input
                    id="priceFrom"
                    inputMode="numeric"
                    value={grouped(draft.priceFrom)}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, priceFrom: digits(event.target.value) }))
                    }
                    aria-invalid={errors.priceFrom !== undefined}
                    className={`w-40 tabular-nums ${field(errors.priceFrom !== undefined)}`}
                  />
                </label>
                <label className="flex items-center gap-sm" htmlFor="priceTo">
                  <span className={hintText}>{quotePage.priceTo}</span>
                  <input
                    id="priceTo"
                    inputMode="numeric"
                    value={grouped(draft.priceTo)}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, priceTo: digits(event.target.value) }))
                    }
                    aria-invalid={errors.priceFrom !== undefined}
                    className={`w-40 tabular-nums ${field(errors.priceFrom !== undefined)}`}
                  />
                </label>
              </div>
              {errors.priceFrom ? (
                <p className={`mt-xs ${errorTextClass}`}>{errors.priceFrom}</p>
              ) : (
                <p className={`mt-xs ${hintText}`}>{quotePage.priceHint}</p>
              )}
            </fieldset>

            <label className="mt-xl block" htmlFor="leadTime">
              <span className={fieldLabel}>{quotePage.leadTimeLabel}</span>
              <input
                id="leadTime"
                inputMode="numeric"
                value={draft.leadTimeDays}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    leadTimeDays: digits(event.target.value, 3),
                  }))
                }
                aria-invalid={errors.leadTimeDays !== undefined}
                className={`mt-sm block w-40 tabular-nums ${field(errors.leadTimeDays !== undefined)}`}
              />
            </label>
            {errors.leadTimeDays && (
              <p className={`mt-xs ${errorTextClass}`}>{errors.leadTimeDays}</p>
            )}
          </div>

          <button type="button" onClick={send} disabled={sending} className={`mt-xl ${buttonFilled}`}>
            {sending ? quotePage.submitting : quotePage.submit}
          </button>
          {sendError && <p className={`mt-lg ${errorTextClass}`}>{sendError}</p>}
        </section>
      )}
    </MasterShell>
  )
}

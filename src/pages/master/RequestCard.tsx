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
import { CheckMark } from '../../components/icons'
import {
  badge,
  blockRow,
  blockRowDivider,
  buttonFilled,
  buttonText,
  choiceBox,
  errorTextClass,
  field,
  fieldLabel,
  hintText,
  link,
  panel,
  panelNested,
  stepPanel,
} from '../../components/ui'
import type { Session, QuoteItem, RequestForMaster } from '../../contract'
import {
  compositionAsk,
  compositionFor,
  compositionLabels,
  compositionShown,
  splitComposition,
} from '../../questions/composition'
import {
  applianceList,
  bathroomMount,
  bathroomNeeds,
  bathroomWidth,
  categories,
  cityName,
  finishLevel,
  kitchenUpper,
  otherKind,
  wardrobeInside,
  wardrobePlacement,
  wardrobeDoors,
  kitchenAppliances,
  kitchenShape,
  metersUnit,
} from '../../questions/categories'
import { errorText } from '../../texts/request'
import { quotePage, requestsPage, routedAtLabel } from '../../texts/master'
import { clearSession, hasRole, readSession } from '../../session'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; request: RequestForMaster }
  | { kind: 'foreign' }
  | { kind: 'failed'; message: string }

interface Draft {
  /** Отмеченные позиции состава. Порядок отметки не важен — важен факт. */
  items: QuoteItem[]
  extra: string
  excluded: string
  priceFrom: string
  priceTo: string
  leadTimeDays: string
}

const EMPTY: Draft = { items: [], extra: '', excluded: '', priceFrom: '', priceTo: '', leadTimeDays: '' }

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
/**
 * Список позиций состава — строки блока с отметкой множественного выбора.
 *
 * Чипсами это не собирается (§ Components, 18.09): подписи здесь по 15–25
 * знаков, а чипс держит до 22 и не больше пяти значений в группе. Восемь
 * частей кухни пилюлями встают столбиком с рваным краем — `flex-wrap` при
 * этом стоит и формально соблюдён, переносить просто нечего.
 *
 * Иконки слева нет: нарисовать предметный контур для «Плавного закрывания
 * дверец» нечем, а значок ради значка система запрещает. Каркас держит
 * колонка отметок справа, и длина подписи её не двигает.
 *
 * Вопрос стоит НАД плашкой, а не внутри: плашка держит однородное — сами
 * строки, — а заголовок называет её снаружи (чек-лист экрана, п.1).
 *
 * Ступень вопроса — 22, как у разделов экрана: меткой 14 он был мельче
 * собственной подсказки на 15, и глаз читал пояснение раньше вопроса.
 *
 * Ширина списка — мера текста: на широком экране во всю колонку между
 * подписью «Дверцы» и отметкой оставалось 600px пустоты, и связь между
 * ними приходилось искать. Четвёртой ширины в системе нет, поэтому мера
 * текста, а не «сколько-нибудь поуже».
 */
function ItemList({ question, hint, items, chosen, onToggle, className }: {
  question: string
  hint: string
  items: QuoteItem[]
  chosen: QuoteItem[]
  onToggle: (item: QuoteItem) => void
  className: string
}) {
  return (
    <fieldset className={className}>
      <legend className="text-subheading tracking-subheading font-medium text-balance">
        {question}
      </legend>
      <p className={`mt-sm max-w-measure ${hintText}`}>{hint}</p>
      <div className={`mt-lg max-w-measure ${stepPanel}`}>
        {/* Отрицательный отступ по бокам — чтобы фон выбранной строки доходил
            до краёв плашки, а не висел внутри неё вторым прямоугольником. */}
        <div className="-mx-md">
          {items.map((item) => {
            const on = chosen.includes(item)
            return (
              <div key={item} className={blockRowDivider()}>
                <label className={blockRow(on)}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => onToggle(item)}
                  />
                  <span className="min-w-0">{compositionLabels[item]}</span>
                  <span aria-hidden="true" className={choiceBox(on)}>
                    {on && <CheckMark />}
                  </span>
                </label>
              </div>
            )
          })}
        </div>
      </div>
    </fieldset>
  )
}

/** Число метрами, с запятой и склонённой единицей: «2,4 метра». */
function meters(value: number): string {
  return `${String(value).replace('.', ',')} ${metersUnit(value)}`
}

/** Подписи отмеченного — в порядке самого списка, а не в порядке нажатий. */
function labelsOf<T extends string>(
  options: readonly { id: T; label: string }[],
  ids: readonly T[],
): string {
  return options.filter((option) => ids.includes(option.id)).map((option) => option.label).join(', ')
}

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
  const [session, setSession] = useState<Session | null>(() => readSession())
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  /**
   * US-19b. Правка — режим того же экрана, а не второй экран: мебельщик
   * поправляет вилку между делом, и лишний переход теряет исправление.
   */
  const [revising, setRevising] = useState(false)

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
  // Гейт по роли, а не по факту входа (§5в): вошедший заказчик
  // не должен снова видеть форму входа — он уже вошёл.
  if (!hasRole(session, 'master')) return <Navigate to="/master" replace />
  if (id === undefined) return <Navigate to="/master/requests" replace />

  if (view.kind === 'loading') {
    return (
      <MasterShell masterName={session.master?.name}>
        <p className="text-body tracking-body" role="status">
          {quotePage.loading}
        </p>
      </MasterShell>
    )
  }

  if (view.kind === 'foreign' || view.kind === 'failed') {
    const foreign = view.kind === 'foreign'
    return (
      <MasterShell masterName={session.master?.name}>
        <Title>{foreign ? quotePage.foreignTitle : quotePage.failedTitle}</Title>
        <p className="mt-lg max-w-measure text-body tracking-body">
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
  // Набор позиций под категорию заявки. Контракт принимает любую позицию
  // перечня (§2) — ограничение здесь про форму, а не про договор: показывать
  // мебельщику штанги для одежды в заявке на кухню незачем.
  const { parts, services } = compositionFor(request.details.category)

  /** Отметить или снять позицию. Ошибка состава гаснет первой же отметкой. */
  function toggleItem(item: QuoteItem): void {
    setDraft((current) => ({
      ...current,
      items: current.items.includes(item)
        ? current.items.filter((chosen) => chosen !== item)
        : [...current.items, item],
    }))
    setErrors((current) => ({ ...current, items: undefined }))
  }
  /**
   * Ванная мерится сантиметрами — и в форме, и здесь: «80 см» мебельщик
   * прочтёт быстрее, чем «0,8 метра», а человек назвал именно 80.
   */
  const isBathroom = request.details.category === 'bathroom'
  const size = request.mainSize.known
    ? isBathroom
      ? `${Math.round(request.mainSize.meters * 100)} ${bathroomWidth.unit}`
      : `${String(request.mainSize.meters).replace('.', ',')} ${metersUnit(request.mainSize.meters)}`
    : quotePage.sizeUnknownValue
  const city = cityName(request.city)

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
    if (kitchen.secondWallM !== null)
      details.push({ label: quotePage.secondWallLabel, value: meters(kitchen.secondWallM) })
    if (kitchen.thirdWallM !== null)
      details.push({ label: quotePage.thirdWallLabel, value: meters(kitchen.thirdWallM) })
    const upper = kitchenUpper.options.find((option) => option.id === kitchen.upper)
    if (upper) details.push({ label: quotePage.upperLabel, value: upper.label })
    if (kitchen.ceilingM !== null)
      details.push({ label: quotePage.ceilingHeightLabel, value: meters(kitchen.ceilingM) })
    if (appliances) details.push({ label: quotePage.appliancesLabel, value: appliances.label })
    if (kitchen.applianceList.length > 0)
      details.push({
        label: quotePage.applianceListLabel,
        value: labelsOf(applianceList.options, kitchen.applianceList),
      })
  }
  if (kitchen.category === 'wardrobe') {
    const placement = wardrobePlacement.options.find((option) => option.id === kitchen.placement)
    if (placement) details.push({ label: quotePage.placementLabel, value: placement.label })
    if (kitchen.nicheDepthM !== null)
      details.push({ label: quotePage.nicheDepthLabel, value: meters(kitchen.nicheDepthM) })
    if (kitchen.ceilingM !== null)
      details.push({ label: quotePage.ceilingHeightLabel, value: meters(kitchen.ceilingM) })
    if (kitchen.inside.length > 0)
      details.push({
        label: quotePage.insideLabel,
        value: labelsOf(wardrobeInside.options, kitchen.inside),
      })
  }
  if (kitchen.category === 'bathroom') {
    const mount = bathroomMount.options.find((option) => option.id === kitchen.mount)
    if (mount) details.push({ label: quotePage.mountLabel, value: mount.label })
    if (kitchen.basin !== null)
      details.push({
        label: quotePage.basinLabel,
        value: kitchen.basin === 'have' ? quotePage.basinHave : quotePage.basinNeed,
      })
    if (kitchen.needs.length > 0)
      details.push({
        label: quotePage.needsLabel,
        value: labelsOf(bathroomNeeds.options, kitchen.needs),
      })
  }
  if (kitchen.category === 'other') {
    const kind = otherKind.options.find((option) => option.id === kitchen.kind)
    if (kind) details.push({ label: quotePage.otherKindLabel, value: kind.label })
  }
  details.push({
    label: quotePage.cityLabel,
    value: [city, request.district].filter(Boolean).join(', '),
  })
  // Уровень отделки спрашивается с US-08. Поле необязательное: его могли
  // пропустить в форме — тогда честное «не указан», а не прочерк.
  const finish = finishLevel.options.find((option) => option.id === request.finishLevel)
  details.push({ label: quotePage.finishLabel, value: finish?.label ?? quotePage.notSet })

  function validate(): boolean {
    const found: Partial<Record<keyof Draft, string>> = {}
    if (draft.items.length === 0) found.items = compositionAsk.errorItemsEmpty
    if (draft.excluded.trim() === '') found.excluded = compositionAsk.errorExcludedEmpty
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
    // Правка не создаёт второе КП: у неё своя операция, и quote_sent
    // она не пишет (контракт §5б, updateQuote). Вызов через api, а не через
    // оторванную ссылку на метод: методу может понадобиться свой объект.
    const sendQuote = (t: string, requestId: string, body: Record<string, unknown>) =>
      revising ? api.updateQuote(t, requestId, body) : api.createQuote(t, requestId, body)

    sendQuote(session.token, id, {
        composition: {
          items: draft.items,
          // Пустое «ещё своими словами» не отправляется вовсе: схема ждёт
          // либо текст, либо отсутствие поля, а не пустую строку.
          ...(draft.extra.trim() === '' ? {} : { extra: draft.extra.trim() }),
          excluded: draft.excluded.trim(),
        },
        price: { minKzt: Number(draft.priceFrom), maxKzt: Number(draft.priceTo) },
        leadTimeDays: Number(draft.leadTimeDays),
      })
      .then(
        () => {
          // Перечитываем карточку, а не дорисовываем ответ на месте: вместе
          // с КП открывается телефон заказчицы, и источник у него один — сервер.
          setSending(false)
          setDraft(EMPTY)
          setRevising(false)
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
    <MasterShell masterName={session.master?.name}>
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
      {/* Этап — приглушённой строкой, а не шильдиком: слива уже занята
          отметкой «Отвечено», и второй акцент погасил бы первый
          (DESIGN.md § Выделяется то, что одно). */}
      {request.readiness && (
        <p className={`mt-xs ${hintText}`}>
          {request.readiness === 'ready' ? quotePage.readinessReady : quotePage.readinessPlanning}
        </p>
      )}

      {/* Своими словами — то, ради чего мебельщик открывает заявку. Плашки
          нет намеренно: абзац самостоятелен, а плашка вокруг самостоятельного
          элемента — шум (DESIGN.md § Elevation). */}
      <section className="mt-3xl">
        <h2 className="text-subheading tracking-subheading font-medium">
          {quotePage.describedTitle}
        </h2>
        <p className="mt-sm max-w-measure text-body tracking-body">{request.description}</p>
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
          <p className={`mt-sm max-w-measure ${hintText}`}>{quotePage.noPhotos}</p>
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

      {request.myQuote && !revising ? (
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">
            {quotePage.sentTitle}
          </h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{quotePage.sentBody}</p>

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
              {/* Двумя группами, а не строкой через « · »: позиций до
                  девятнадцати, и одной строкой они читаются как простыня,
                  в которой не найти, входит ли замер (DESIGN.md, список
                  длиннее восьми строк — другой компонент). */}
              {(() => {
                const shown = splitComposition(request.myQuote.composition.items)
                return (
                  <div className="mt-sm max-w-measure">
                    {([['parts', shown.parts], ['services', shown.services]] as const)
                      .filter(([, list]) => list.length > 0)
                      .map(([group, list]) => (
                        <div key={group} className="mt-md first:mt-0">
                          <p className={hintText}>{compositionShown[group]}</p>
                          <ul className="mt-xs">
                            {list.map((item) => (
                              <li key={item} className="mt-xs text-body-sm tracking-body-sm first:mt-0">
                                {compositionLabels[item]}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                )
              })()}
              {request.myQuote.composition.extra !== undefined && (
                <p className="mt-xs max-w-measure text-body-sm tracking-body-sm">
                  {request.myQuote.composition.extra}
                </p>
              )}
              <p className={`mt-xs max-w-measure ${hintText}`}>
                {compositionAsk.excludedLabel}: {request.myQuote.composition.excluded}
              </p>
              {request.myQuote.updatedAt !== null && (
                <p className={`mt-sm ${hintText}`}>
                  {quotePage.revisedNote(routedAtLabel(request.myQuote.updatedAt))}
                </p>
              )}
            </div>
          </div>

          {/* US-19b: правка вместо второго КП. Отправив второе предложение,
              мебельщик оставил бы заказчице две своих цены без правила,
              какая настоящая. */}
          <button
            type="button"
            className={`mt-xl ${buttonText}`}
            onClick={() => {
              const mine = request.myQuote!
              setDraft({
                items: [...mine.composition.items],
                extra: mine.composition.extra ?? '',
                excluded: mine.composition.excluded,
                priceFrom: String(mine.price.minKzt),
                priceTo: String(mine.price.maxKzt),
                leadTimeDays: String(mine.leadTimeDays),
              })
              setErrors({})
              setSendError(null)
              setRevising(true)
            }}
          >
            {quotePage.revise}
          </button>
        </section>
      ) : (
        <section className="mt-3xl">
          {/* Своего заголовка у блока ответа нет, и это решение PM 18.09:
              вопросы набраны той же ступенью 22, что «Что просят» и
              «Подробности», то есть каждый вопрос — раздел экрана. Заголовок
              «Ваш ответ» встал бы над ними третьим ярусом, а ступени между
              22 и 17 в системе не существует.

              Предупреждение остаётся и стоит ПЕРЕД вопросами: «главное
              в конце» относится к действию, а предупреждение о том, что
              ответ один, работает только до того, как человек начал
              отвечать (§ Порядок важнее полноты). */}
          <p className={`max-w-measure ${hintText}`}>
            {revising ? quotePage.reviseHint : quotePage.formHint}
          </p>
          {!revising && !request.mainSize.known && (
            <p className={`mt-sm max-w-measure ${hintText}`}>{quotePage.formHintNoSize}</p>
          )}

          {/* Состав отмечается, а не пишется (контракт §2, решение 17.09):
              два свободных текста рядом сравнить нельзя — сравнивалась бы
              многословность. Части предмета и работы разведены нарочно:
              разница в цене чаще лежит во второй группе, и пока она стояла
              вперемешку с фасадами, про неё просто не писали. */}
          <ItemList
            className="mt-3xl"
            question={compositionAsk.partsQuestion}
            hint={compositionAsk.partsHint}
            items={parts}
            chosen={draft.items}
            onToggle={toggleItem}
          />
          <ItemList
            className="mt-3xl"
            question={compositionAsk.servicesQuestion}
            hint={compositionAsk.servicesHint}
            items={services}
            chosen={draft.items}
            onToggle={toggleItem}
          />
          {errors.items && <p className={`mt-md ${errorTextClass}`}>{errors.items}</p>}

          {/* Своими словами, что не входит, цена и срок — одна группа: это
              и есть ответ, который уедет заказчице. Состав выше собран
              строками и в плашку полей не вкладывается: третьего уровня
              поверхности в системе нет. */}
          <div className={`mt-xl ${panel}`}>
            <label className="block" htmlFor="extra">
              <span className={fieldLabel}>{compositionAsk.extraLabel}</span>
              <textarea
                id="extra"
                rows={2}
                value={draft.extra}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, extra: event.target.value }))
                }
                placeholder={compositionAsk.extraPlaceholder}
                className={`mt-sm block w-full ${field(false)}`}
              />
            </label>
            <p className={`mt-xs ${hintText}`}>{compositionAsk.extraHint}</p>

            {/* Обязательное поле, и это главное в затее: замер, доставка
                и подъём у одного внутри вилки, у другого сверху. Пока про это
                не спрашивали, заказчица узнавала разницу на дозвоне. */}
            <label className="mt-xl block" htmlFor="excluded">
              <span className={fieldLabel}>{compositionAsk.excludedLabel}</span>
              <textarea
                id="excluded"
                rows={2}
                value={draft.excluded}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, excluded: event.target.value }))
                }
                placeholder={compositionAsk.excludedPlaceholder}
                aria-invalid={errors.excluded !== undefined}
                className={`mt-sm block w-full ${field(errors.excluded !== undefined)}`}
              />
            </label>
            {errors.excluded ? (
              <p className={`mt-xs ${errorTextClass}`}>{errors.excluded}</p>
            ) : (
              <p className={`mt-xs max-w-measure ${hintText}`}>{compositionAsk.excludedHint}</p>
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
                    className={`w-[10rem] tabular-nums ${field(errors.priceFrom !== undefined)}`}
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
                    className={`w-[10rem] tabular-nums ${field(errors.priceFrom !== undefined)}`}
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
                className={`mt-sm block w-[10rem] tabular-nums ${field(errors.leadTimeDays !== undefined)}`}
              />
            </label>
            {errors.leadTimeDays && (
              <p className={`mt-xs ${errorTextClass}`}>{errors.leadTimeDays}</p>
            )}
          </div>

          <div className="mt-xl flex flex-wrap items-center gap-md">
            <button type="button" onClick={send} disabled={sending} className={buttonFilled}>
              {sending
                ? quotePage.submitting
                : revising
                  ? quotePage.reviseSubmit
                  : quotePage.submit}
            </button>
            {revising && (
              <button
                type="button"
                className={buttonText}
                onClick={() => {
                  setRevising(false)
                  setDraft(EMPTY)
                  setErrors({})
                }}
              >
                {quotePage.reviseCancel}
              </button>
            )}
          </div>
          {sendError && <p className={`mt-lg ${errorTextClass}`}>{sendError}</p>}
        </section>
      )}
    </MasterShell>
  )
}

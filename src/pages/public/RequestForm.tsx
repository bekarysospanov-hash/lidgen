import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { CategoryIcon } from '../../components/CategoryIcon'
import { KitchenShape } from '../../components/KitchenShape'
import { OtpConfirm } from '../../components/OtpConfirm'
import { PageShell } from '../../components/PageShell'
import { PhoneInput } from '../../components/PhoneInput'
import {
  buttonFilled,
  errorTextClass,
  field,
  fieldLabel,
  hintText,
  optionCard,
  optionMark,
  panel,
} from '../../components/ui'
import { City, Description, MainSize, Phone } from '../../contract'
import type {
  CityCode,
  CreateRequest,
  Details,
  MainSize as MainSizeValue,
  RequestCreated,
} from '../../contract'
import {
  categories,
  city as cityAsk,
  description as descriptionAsk,
  formSteps,
  kitchenAppliances,
  kitchenShape,
  mainSize,
  mainSizeAsk,
  metersUnit,
  phone as phoneAsk,
  screen,
  stepLabel,
  summary,
  type CategoryId,
} from '../../questions/categories'
import { errorText, validationUnmapped } from '../../texts/request'

/**
 * Секция-вопрос. Разделяется расстоянием, а не линией: 48 между блоками при
 * 12–16 внутри блока уже дают группировку, и разделитель поверх неё —
 * шум (DESIGN.md § Layout: «расстояние — главный инструмент группировки»).
 */
function Section({ children }: { children: React.ReactNode }) {
  return <section className="mt-3xl first:mt-0">{children}</section>
}

/**
 * Вопрос: счётчик шага, заголовок блока, подсказка. Счётчик нужен потому,
 * что шесть-семь секций подряд без обещания длины человек с телефона просто
 * закрывает.
 *
 * Плашкой вопрос НЕ оборачивается, хотя соблазн есть: карточки вариантов
 * внутри неё оказались бы на втором уровне поверхности, и выбранной было бы
 * некуда подниматься — потолок вложенности (DESIGN.md § Elevation).
 */
function Ask({ step, title, hint, children }: {
  step: string; title: string; hint?: string; children: React.ReactNode
}) {
  return (
    <>
      <p className={hintText}>{step}</p>
      <h2 className="mt-xs text-subheading tracking-subheading font-medium text-balance">
        {title}
      </h2>
      {hint && <p className={`mt-sm max-w-[62ch] ${hintText}`}>{hint}</p>}
      <div className="mt-lg">{children}</div>
    </>
  )
}

/** Метка выбранного варианта — сливовый квадрат (DESIGN.md § Состояния). */
function Mark({ on }: { on: boolean }) {
  return <span aria-hidden="true" className={optionMark(on)} />
}

/**
 * Сообщение под полем. Ошибка — красным на 15px: § Состояния требует менять
 * вместе границу поля и текст под ним, одной красной рамки человек на
 * телефоне не замечает. Место под сообщение держится всегда, иначе появление
 * ошибки дёргает вёрстку.
 */
function Note({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  return (
    <div className="mt-sm min-h-[1.5lh] max-w-[58ch]">
      {error
        ? <p id={id} role="alert" className={errorTextClass}>{error}</p>
        : hint ? <p id={id} className={hintText}>{hint}</p> : null}
    </div>
  )
}

/** Подпись варианта: подчёркивается при наведении на карточку. */
const optLabel = 'group-hover:underline underline-offset-4'

type ShapeId = (typeof kitchenShape.options)[number]['id']
type ApplianceId = (typeof kitchenAppliances.options)[number]['id']
type FieldKey = 'size' | 'description' | 'city' | 'cityName' | 'phone'
type FieldErrors = Partial<Record<FieldKey, string>>

/** Куда ставить фокус по первой незакрытой ошибке — порядок как на экране. */
const FOCUS_ORDER: [FieldKey, string][] = [
  ['size', 'main-size'],
  ['description', 'description'],
  ['city', 'city-almaty'],
  ['cityName', 'city-other-name'],
  ['phone', 'phone'],
]

export default function RequestForm() {
  const navigate = useNavigate()

  const [category, setCategory] = useState<CategoryId | null>(null)
  const [size, setSize] = useState('')
  const [sizeUnknown, setSizeUnknown] = useState(false)
  const [shape, setShape] = useState<ShapeId | null>(null)
  const [appliances, setAppliances] = useState<ApplianceId | null>(null)
  const [text, setText] = useState('')
  const [cityCode, setCityCode] = useState<CityCode | null>(null)
  const [cityName, setCityName] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')

  const [errors, setErrors] = useState<FieldErrors>({})
  const [sendError, setSendError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<RequestCreated | null>(null)
  /**
   * Отсчёт из retryAfterSec сервера при RATE_LIMITED. Пока он идёт, кнопка
   * недоступна: активная кнопка под лимитом приглашает долбить сервер,
   * а он всё равно ответит тем же кодом (контракт §6).
   */
  const [cooldown, setCooldown] = useState(0)

  /**
   * Ключ идемпотентности: один на попытку отправки, а не на клик (контракт §8).
   * Живёт в ref, чтобы ретрай после обрыва связи ушёл с тем же значением
   * и сервер вернул ту же заявку вместо второй.
   */
  const attemptId = useRef<string | null>(null)

  /**
   * Правка полей после неуспешной отправки закрывает попытку: с тем же ключом
   * сервер по идемпотентности вернул бы ПЕРВУЮ заявку, и правки исчезли бы
   * молча (контракт §5, §8). Ключ «на попытку отправки» — значит на попытку,
   * а не на жизнь формы: изменившееся содержимое — уже другая попытка.
   */
  function touched() {
    if (attemptId.current) attemptId.current = null
    if (cooldown > 0) setCooldown(0)
  }

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((left) => Math.max(0, left - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const isKitchen = category === 'kitchen'
  const stage: 'form' | 'otp' = created ? 'otp' : 'form'

  /**
   * Счётчик считает по фактическому набору секций выбранной категории:
   * у кухни их семь, у остальных пять. Число не пишется в разметке —
   * добавится вопрос, счётчик пересчитается сам.
   */
  const steps = formSteps(category)

  const L = summary.labels
  const rows: [string, string][] = []
  if (category) rows.push([L.category, categories.find((c) => c.id === category)!.label])
  const sizeLabel = isKitchen ? L.size : L.sizeOther
  if (sizeUnknown) rows.push([sizeLabel, L.sizeUnknown])
  else if (size.trim()) rows.push([sizeLabel, `${size.trim()} ${metersUnit(size)}`])
  if (shape) rows.push([L.shape, kitchenShape.options.find((o) => o.id === shape)!.label])
  if (appliances)
    rows.push([L.appliances, kitchenAppliances.options.find((o) => o.id === appliances)!.label])
  if (cityCode)
    rows.push([
      L.city,
      cityCode === 'other'
        ? cityName.trim() || cityAsk.options.find((o) => o.id === cityCode)!.label
        : cityAsk.options.find((o) => o.id === cityCode)!.label,
    ])

  /**
   * Валидация полей схемами контракта — своих регулярок на экране нет.
   * Категория приходит параметром, уже выбранной: ветки «категории нет»
   * здесь нет, потому что до выбора на экране нет ни одного поля и ни одной
   * кнопки отправки — отправлять нечего и нечем.
   */
  function build(chosen: CategoryId): { payload: CreateRequest } | { errors: FieldErrors } {
    const next: FieldErrors = {}

    let sizeValue: MainSizeValue | null = null
    if (sizeUnknown) {
      sizeValue = { known: false }
    } else if (size.trim().length === 0) {
      next.size = mainSize.errorEmpty
    } else {
      const parsed = MainSize.safeParse({ known: true, meters: Number(size.trim().replace(',', '.')) })
      if (parsed.success) sizeValue = parsed.data
      else next.size = mainSize.errorInvalid
    }

    const parsedText = Description.safeParse(text)
    if (!parsedText.success) {
      next.description = text.trim().length === 0
        ? descriptionAsk.errorEmpty
        : descriptionAsk.errorTooLong
    }

    let cityValue: CreateRequest['city'] | null = null
    if (!cityCode) {
      next.city = cityAsk.errorEmpty
    } else {
      const parsed = City.safeParse({
        code: cityCode,
        name: cityCode === 'other' ? cityName.trim() : null,
      })
      if (parsed.success) cityValue = parsed.data
      else next.cityName = cityAsk.errorOtherEmpty
    }

    let phoneValue: string | null = null
    if (phoneDigits.length === 0) {
      next.phone = phoneAsk.errorEmpty
    } else {
      const parsed = Phone.safeParse(`+7${phoneDigits}`)
      if (parsed.success) phoneValue = parsed.data
      else next.phone = phoneAsk.errorInvalid
    }

    if (!sizeValue || !parsedText.success || !cityValue || !phoneValue) return { errors: next }

    const details: Details = chosen === 'kitchen'
      ? { category: 'kitchen', shape, appliances }
      : { category: chosen }

    if (!attemptId.current) attemptId.current = crypto.randomUUID()

    return {
      payload: {
        details,
        mainSize: sizeValue,
        description: parsedText.data,
        city: cityValue,
        phone: phoneValue,
        clientRequestId: attemptId.current,
      },
    }
  }

  /**
   * VALIDATION_FAILED с сервера раскладывается по тем же полям экрана.
   * Экран знает пять путей; всё остальное (consent, source, district, поле,
   * которого на фронте ещё нет) по полям не разложится — и об этом надо
   * сказать вслух: «Проверьте отмеченные поля» при ничем не отмеченных
   * полях отправляет человека искать то, чего на экране нет.
   */
  function fromServerFields(details: unknown): { found: FieldErrors; unmapped: string[] } {
    const fields = (details as { fields?: { path: string; message: string }[] } | undefined)?.fields
    const found: FieldErrors = {}
    const unmapped: string[] = []
    for (const field of fields ?? []) {
      if (field.path.startsWith('mainSize')) found.size = mainSize.errorInvalid
      else if (field.path.startsWith('description')) found.description = descriptionAsk.errorEmpty
      else if (field.path === 'city.name') found.cityName = cityAsk.errorOtherEmpty
      else if (field.path.startsWith('city')) found.city = cityAsk.errorEmpty
      else if (field.path.startsWith('phone')) found.phone = phoneAsk.errorInvalid
      else unmapped.push(field.path)
    }
    return { found, unmapped }
  }

  function focusFirst(found: FieldErrors) {
    const first = FOCUS_ORDER.find(([key]) => found[key])
    if (first) document.getElementById(first[1])?.focus()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy || cooldown > 0) return
    // Отправлять до выбора категории нечего: ни полей, ни кнопки ещё нет.
    if (!category) return

    const result = build(category)
    if ('errors' in result) {
      setErrors(result.errors)
      setSendError(null)
      focusFirst(result.errors)
      return
    }

    setErrors({})
    setSendError(null)
    setBusy(true)
    try {
      setCreated(await api.createRequest(result.payload))
    } catch (caught) {
      if (isApiError(caught)) {
        let message = errorText[caught.code]
        if (caught.code === 'VALIDATION_FAILED') {
          const { found, unmapped } = fromServerFields(caught.details)
          setErrors(found)
          focusFirst(found)
          // Ни одно поле экрана не отметилось — честнее сказать это прямо,
          // чем звать проверять отметки, которых нет.
          if (Object.keys(found).length === 0) message = validationUnmapped(unmapped)
        }
        // Кулдаун берётся из ответа сервера, а не из своего таймера (§6).
        const retryAfterSec = Number(caught.details?.retryAfterSec ?? 0)
        if (retryAfterSec > 0) setCooldown(retryAfterSec)
        // Связь оборвалась — введённое остаётся на экране, кнопка снова
        // активна, ретрай уходит с тем же clientRequestId (контракт §8).
        setSendError(message)
      } else {
        setSendError(errorText.INTERNAL)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <h1 className="max-w-[20ch] text-heading tracking-heading font-semibold">{screen.title}</h1>
      {stage === 'form' && (
        <p className="mt-lg max-w-[58ch] text-body tracking-body">{screen.lede}</p>
      )}

      {stage === 'otp' && created && (
        <div className="mt-xl">
          <OtpConfirm
            requestId={created.id}
            phone={`+7${phoneDigits}`}
            otp={created.otp}
            onRestart={() => {
              // Возврат к форме: ответы на экране остались, а ключ попытки
              // сбрасывается — новая отправка обязана создать новую заявку,
              // а не вернуть по идемпотентности ту, что уже подтверждена.
              attemptId.current = null
              setCreated(null)
              setSendError(null)
            }}
            onConfirmed={(confirmed) => {
              // Состояние передаётся роутером (history.state): ни localStorage,
              // ни sessionStorage (спека §8, US-11). Телефон сюда не кладётся
              // ни в каком виде — только номер заявки, токен и статус (§7).
              navigate('/request/sent', {
                state: {
                  number: confirmed.request.number,
                  token: confirmed.token,
                  status: confirmed.request.status,
                },
              })
            }}
          />
          <Section>
            <div className={panel}>
              <p className="text-subheading tracking-subheading font-medium">{summary.title}</p>
              <dl className="mt-md text-body-sm tracking-body-sm">
                {rows.map(([k, v]) => (
                  <div key={k} className="mt-sm flex gap-md">
                    <dt className={`w-40 shrink-0 ${hintText}`}>{k}</dt>
                    <dd className="min-w-0 tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Section>
        </div>
      )}

      {stage === 'form' && (
      <form onSubmit={submit} className="mt-xl">
        <Section>
          <Ask step={stepLabel('category', steps, category)} title={screen.stepCategory}>
            {/* Две колонки, а не четыре: у категории есть подсказка, и в
                четверти ширины она рассыпается на три строки. */}
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              {categories.map((c) => (
                <label key={c.id} className={optionCard(category === c.id)}>
                  <input type="radio" name="category" value={c.id} className="sr-only"
                    checked={category === c.id}
                    onChange={() => { setCategory(c.id); setErrors({}); touched() }} />
                  <Mark on={category === c.id} />
                  {/* Иконка несёт содержание, а не украшает: категорию узнают
                      по предмету раньше, чем прочитают слово (§ Иконки). */}
                  <CategoryIcon id={c.id} />
                  <span className="min-w-0">
                    <span className={`block ${optLabel}`}>{c.label}</span>
                    <span className={`mt-xs block ${hintText}`}>{c.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </Ask>
        </Section>

        {category && (
          <>
            {/* Размер — общее поле всех категорий (контракт §2), спрашивается
                у всех; формулировка вопроса зависит от категории. */}
            <Section>
              <Ask step={stepLabel('size', steps, category)}
                title={mainSizeAsk(category).question} hint={mainSizeAsk(category).hint}>
                <div className="flex items-baseline gap-sm">
                  <input id="main-size" inputMode="decimal" autoComplete="off"
                    value={size} disabled={sizeUnknown} placeholder={mainSize.placeholder}
                    aria-invalid={Boolean(errors.size)}
                    aria-describedby="size-note"
                    onChange={(e) => { setSize(e.target.value); setErrors({ ...errors, size: undefined }); touched() }}
                    className={`w-40 tabular-nums ${field(Boolean(errors.size))}`} />
                  {/* Подпись единицы склоняется по введённому: «3,2 метра». */}
                  <span className={hintText}>{metersUnit(size)}</span>
                </div>
                <label className={`${optionCard(sizeUnknown)} mt-lg inline-flex items-center`}>
                  <input type="checkbox" className="sr-only" checked={sizeUnknown}
                    onChange={(e) => { setSizeUnknown(e.target.checked); setErrors({ ...errors, size: undefined }); touched() }} />
                  <Mark on={sizeUnknown} />
                  <span className={`whitespace-nowrap ${optLabel}`}>{mainSize.unknownLabel}</span>
                </label>
                <Note id="size-note" error={errors.size}
                  hint={sizeUnknown ? mainSize.unknownNote : undefined} />
              </Ask>
            </Section>

            {isKitchen && (
              <>
                <Section>
                  <Ask step={stepLabel('shape', steps, category)}
                    title={kitchenShape.question} hint={kitchenShape.hint}>
                    <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
                      {kitchenShape.options.map((o) => (
                        <label key={o.id} className={`${optionCard(shape === o.id)} flex-col`}>
                          <input type="radio" name="shape" value={o.id} className="sr-only"
                            checked={shape === o.id} onChange={() => { setShape(o.id); touched() }} />
                          {/* Рамки вокруг схемы больше нет: плашка карточки её уже
                              отделяет, а рамка внутри рамки давала двойной контур
                              (§ Elevation — обводки блоков не применяются). */}
                          <KitchenShape id={o.id} />
                          {/* Индикатор стоит перед подписью и на одной строке с ней —
                              как во всех остальных карточках формы, а не в углу. */}
                          <span className="mt-md flex items-start gap-sm">
                            <Mark on={shape === o.id} />
                            <span className={optLabel}>{o.label}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </Ask>
                </Section>

                <Section>
                  <Ask step={stepLabel('appliances', steps, category)}
                    title={kitchenAppliances.question} hint={kitchenAppliances.hint}>
                    <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
                      {kitchenAppliances.options.map((o) => (
                        <label key={o.id} className={`${optionCard(appliances === o.id)} items-center`}>
                          <input type="radio" name="appliances" value={o.id} className="sr-only"
                            checked={appliances === o.id} onChange={() => { setAppliances(o.id); touched() }} />
                          <Mark on={appliances === o.id} />
                          <span className={optLabel}>{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </Ask>
                </Section>
              </>
            )}

            <Section>
              <Ask step={stepLabel('description', steps, category)}
                title={descriptionAsk.question} hint={descriptionAsk.hint}>
                <textarea id="description" rows={5} value={text}
                  placeholder={descriptionAsk.placeholder}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby="description-note"
                  onChange={(e) => { setText(e.target.value); setErrors({ ...errors, description: undefined }); touched() }}
                  className={`block w-full max-w-[62ch] resize-y ${field(Boolean(errors.description))}`} />
                <Note id="description-note" error={errors.description} />
              </Ask>
            </Section>

            <Section>
              <Ask step={stepLabel('city', steps, category)} title={cityAsk.question} hint={cityAsk.hint}>
                <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
                  {cityAsk.options.map((o) => (
                    <label key={o.id} className={`${optionCard(cityCode === o.id)} items-center`}>
                      <input type="radio" name="city" id={`city-${o.id}`} value={o.id}
                        className="sr-only" checked={cityCode === o.id}
                        onChange={() => { setCityCode(o.id); setErrors({ ...errors, city: undefined }); touched() }} />
                      <Mark on={cityCode === o.id} />
                      <span className={optLabel}>{o.label}</span>
                    </label>
                  ))}
                </div>
                {cityCode === 'other' && (
                  <div className="mt-lg">
                    <label htmlFor="city-other-name" className={`block ${fieldLabel}`}>
                      {cityAsk.otherLabel}
                    </label>
                    <input id="city-other-name" autoComplete="address-level2" value={cityName}
                      placeholder={cityAsk.otherPlaceholder}
                      aria-invalid={Boolean(errors.cityName)}
                      aria-describedby="city-note"
                      onChange={(e) => { setCityName(e.target.value); setErrors({ ...errors, cityName: undefined }); touched() }}
                      className={`mt-sm block w-full max-w-[32ch] ${field(Boolean(errors.cityName))}`} />
                  </div>
                )}
                <Note id="city-note" error={errors.city ?? errors.cityName} />
              </Ask>
            </Section>

            <Section>
              <Ask step={stepLabel('phone', steps, category)} title={phoneAsk.question} hint={phoneAsk.hint}>
                <PhoneInput id="phone" value={phoneDigits}
                  invalid={Boolean(errors.phone)} describedBy="phone-note"
                  onChange={(digits) => { setPhoneDigits(digits); setErrors({ ...errors, phone: undefined }); touched() }} />
                <Note id="phone-note" error={errors.phone} />
              </Ask>
            </Section>

            {/* Сводка — тот случай, когда плашка обязательна: разнородные
                строки образуют одно целое «вот что уйдёт мебельщикам»
                (DESIGN.md § Elevation). */}
            <Section>
              <div className={panel}>
                <p className="text-subheading tracking-subheading font-medium">{summary.title}</p>
                <dl className="mt-md text-body-sm tracking-body-sm">
                  {rows.map(([k, v]) => (
                    <div key={k} className="mt-sm flex gap-md">
                      <dt className={`w-40 shrink-0 ${hintText}`}>{k}</dt>
                      <dd className="min-w-0 tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Кнопка стоит на холсте, а не внутри плашки: главное действие
                  экрана не принадлежит сводке, оно принадлежит странице. */}
              <div className="mt-xl">
                <button type="submit" disabled={busy || cooldown > 0}
                  className={`whitespace-nowrap ${buttonFilled}`}>
                  {busy
                    ? screen.submitting
                    : cooldown > 0
                      ? screen.submitIn(cooldown)
                      : screen.submit}
                </button>
                <div className="mt-md max-w-[40ch]">
                  {sendError && <p role="alert" className={errorTextClass}>{sendError}</p>}
                  {!sendError && <p className={hintText}>{screen.submitHint}</p>}
                  {sizeUnknown && <p className={`mt-sm ${hintText}`}>{screen.incompleteNote}</p>}
                </div>
              </div>
            </Section>
          </>
        )}
      </form>
      )}
    </PageShell>
  )
}

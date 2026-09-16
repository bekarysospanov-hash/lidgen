import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { CategoryIcon } from '../../components/CategoryIcon'
import { CloseIcon } from '../../components/icons'
import { KitchenShape } from '../../components/KitchenShape'
import { OtpConfirm } from '../../components/OtpConfirm'
import { PageShell } from '../../components/PageShell'
import { PhoneInput } from '../../components/PhoneInput'
import {
  blockRow,
  blockRowDivider,
  buttonFilled,
  buttonText,
  chip,
  choiceDot,
  errorTextClass,
  field,
  fieldLabel,
  hintText,
  link,
  panel,
  stepPanel,
} from '../../components/ui'
import { City, Description, MainSize, PHOTO_MAX_COUNT, PHOTO_MIME, Phone } from '../../contract'
import type {
  CityCode,
  CreateRequest,
  Details,
  MainSize as MainSizeValue,
  Photo,
  RequestCreated,
} from '../../contract'
import {
  categories,
  city as cityAsk,
  description as descriptionAsk,
  photos as photosAsk,
  kitchenAppliances,
  kitchenShape,
  mainSize,
  mainSizeAsk,
  metersUnit,
  phone as phoneAsk,
  screen,
  summary,
  type CategoryId,
} from '../../questions/categories'
import { consentRow, POLICY_VERSION } from '../../texts/privacy'
import { errorText, validationUnmapped } from '../../texts/request'

/**
 * Секция-вопрос. Разделяется расстоянием, а не линией: 48 между блоками при
 * 12–16 внутри блока уже дают группировку, и разделитель поверх неё —
 * шум (DESIGN.md § Layout: «расстояние — главный инструмент группировки»).
 */
function Section({ children }: { children: React.ReactNode }) {
  return <section className="mt-2xl first:mt-0">{children}</section>
}

/**
 * Шаг — блок с подложкой: счётчик, вопрос и подсказка в шапке, варианты
 * в теле. Так вопрос и ответы читаются как одно целое, а не висят рядом
 * на холсте.
 *
 * Счётчик стоит здесь, а не в шапке страницы: все семь вопросов живут на
 * одной прокрутке, и «Шаг 1 из 7» наверху экрана был бы неправдой — он
 * не менялся бы при переходе к следующему.
 */
function Ask({ title, hint, plain = false, children }: {
  title: string
  hint?: string
  /** Поле ввода группировать нечего — оно стоит прямо на холсте, без плашки. */
  plain?: boolean
  children: React.ReactNode
}) {
  return (
    <>
      <h2 className="text-subheading tracking-subheading font-medium text-balance">
        {title}
      </h2>
      {hint && <p className={`mt-xs max-w-[62ch] ${hintText}`}>{hint}</p>}
      <div className={plain ? 'mt-md' : `${stepPanel} mt-md`}>{children}</div>
    </>
  )
}

/**
 * Точка выбора — круг, залитый зелёным у отмеченного (DESIGN.md § Состояния).
 * Квадрат отсюда убран сознательно: PM проверил на себе, что глаз его
 * проскакивает мимо.
 */
function Dot({ on }: { on: boolean }) {
  return <span aria-hidden="true" className={choiceDot(on)} />
}

/**
 * Список строк. Разделитель живёт на обёртке, а не на самой строке: у
 * выбранной строки своя зелёная обводка, и линия на том же элементе с ней
 * спорила бы. Отрицательный отступ по бокам — чтобы фон выбранной доходил
 * до краёв блока, а не обрывался внутри.
 */
function Rows({ children }: { children: React.ReactNode }) {
  return <div className="-mx-md">{children}</div>
}

/**
 * Сообщение под полем. Ошибка — красным на 15px: § Состояния требует менять
 * вместе границу поля и текст под ним, одной красной рамки человек на
 * телефоне не замечает. Место под сообщение держится всегда, иначе появление
 * ошибки дёргает вёрстку.
 */
function Note({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  // Пустое место под сообщение больше не резервируется: у блоков без полей
  // его нет, и ритм между блоками получался рваным — 72 пикселя после одного
  // вопроса против 48 после другого. Вёрстку от появления ошибки сдвинет,
  // но сдвинет внутри блока, а не разъедет всю страницу.
  if (!error && !hint) return null
  return (
    <div className="mt-md max-w-[58ch]">
      {error
        ? <p id={id} role="alert" className={errorTextClass}>{error}</p>
        : <p id={id} className={hintText}>{hint}</p>}
    </div>
  )
}

/**
 * Отказ загрузки — в человеческий текст. Ключуемся по details.path, который
 * контракт обещает у VALIDATION_FAILED (§5, §6): сервер называет причину
 * машинно, а формулировку выбирает экран.
 */
function photoErrorText(caught: unknown): string {
  if (!isApiError(caught)) return photosAsk.errorFailed
  const path = String(caught.details?.path ?? '')
  if (path === 'photo.mime') return photosAsk.errorMime
  if (path === 'photo.bytes') return photosAsk.errorBytes
  return photosAsk.errorFailed
}

/**
 * Сводка ответов. Показывается дважды — на шаге с кодом и над кнопкой, —
 * и до этой правки была скопирована в оба места: правка в одном тихо
 * расходилась со вторым. Плашка здесь обязательна: разнородные строки
 * образуют одно целое «вот что уйдёт мебельщикам» (DESIGN.md § Elevation).
 */
function Summary({ rows }: { rows: [string, string][] }) {
  return (
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
  )
}

/** Подпись варианта: подчёркивается при наведении на карточку. */
const optLabel = 'group-hover:underline underline-offset-4'

type ShapeId = (typeof kitchenShape.options)[number]['id']
type ApplianceId = (typeof kitchenAppliances.options)[number]['id']
type FieldKey = 'size' | 'description' | 'city' | 'cityName' | 'phone' | 'consent'
type FieldErrors = Partial<Record<FieldKey, string>>

/** Куда ставить фокус по первой незакрытой ошибке — порядок как на экране. */
const FOCUS_ORDER: [FieldKey, string][] = [
  ['size', 'main-size'],
  ['description', 'description'],
  ['city', 'city-almaty'],
  ['cityName', 'city-other-name'],
  ['phone', 'phone'],
  ['consent', 'consent'],
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
  /** US-10. Пустой список — законное состояние, отправку фото не держит. */
  const [photoList, setPhotoList] = useState<Photo[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const filePicker = useRef<HTMLInputElement>(null)

  const [errors, setErrors] = useState<FieldErrors>({})
  /**
   * US-11. Отметка живёт в состоянии экрана и никуда не сохраняется между
   * заходами: согласие даётся на конкретную отправку, а «однажды отмеченное»
   * согласие согласием не является.
   */
  const [consentGiven, setConsentGiven] = useState(false)
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

  /**
   * Файлы грузятся по одному и по мере готовности: браузер отдаёт список
   * разом, но сервер принимает по одному (контракт §5). Первая же ошибка
   * останавливает очередь — сыпать пять одинаковых отказов незачем.
   *
   * Ошибка загрузки не трогает остальную форму: фото не блокирует отправку
   * (US-10), поэтому оно и не попадает в errors, где живут блокирующие.
   */
  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return
    setPhotoError(null)
    const room = PHOTO_MAX_COUNT - photoList.length
    if (room <= 0) {
      setPhotoError(photosAsk.errorTooMany)
      return
    }
    setPhotoBusy(true)
    try {
      for (const file of Array.from(files).slice(0, room)) {
        try {
          const photo = await api.uploadPhoto(file)
          setPhotoList((list) => [...list, photo])
          touched()
        } catch (caught) {
          setPhotoError(photoErrorText(caught))
          break
        }
      }
      if (files.length > room) setPhotoError(photosAsk.errorTooMany)
    } finally {
      setPhotoBusy(false)
    }
  }

  /**
   * Снимок снимается и с экрана, и с сервера. Отказ сервера намеренно
   * проглатывается: для человека снимок уже убран, и возвращать его назад
   * из-за неудачной уборки — худшее, что можно сделать. Мусор в хранилище
   * подчистит серверная сборка, а blob: во вкладке отзывает мок.
   */
  function removePhoto(id: string) {
    setPhotoList((list) => list.filter((p) => p.id !== id))
    setPhotoError(null)
    touched()
    void api.deletePhoto(id).catch(() => {})
  }

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((left) => Math.max(0, left - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const isKitchen = category === 'kitchen'
  const stage: 'form' | 'otp' = created ? 'otp' : 'form'

  // Счётчик шагов убран целиком, вместе с механикой в src/questions
  // (решение PM, 16.09): счётчик, заголовок и плашка втроём давали
  // лестницу, а число вопросов уже названо в лиде.

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

    // Без согласия заявка не собирается вовсе. Схема отклонила бы её и так
    // (контракт §5), но человеку нужна причина на экране, а не отказ сервера.
    if (!consentGiven) next.consent = consentRow.error

    if (!sizeValue || !parsedText.success || !cityValue || !phoneValue || !consentGiven) {
      return { errors: next }
    }

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
        // US-10: снимки уходят как есть, включая пустой список. Проверять
        // их здесь нечего — каждый уже принят сервером при загрузке (§5).
        photos: photoList,
        // Версия текста и время отметки, а не булев флаг: доказывать придётся,
        // с чем именно человек согласился и когда (US-11).
        consent: { policyVersion: POLICY_VERSION, acceptedAt: new Date().toISOString() },
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
      {/* Шапка экрана: надстрочник, заголовок, лид. Надстрочник называет
          место — человек приходит по ссылке из рекламы и должен за секунду
          понять, куда попал; заголовок отвечает «что от меня хотят», лид
          снимает главный страх «я не разбираюсь в мебели». Три ступени
          кегля вместо двух дают шапке вес, которого не было у голого текста. */}
      {/* Шапка экрана: надстрочник, заголовок, лид. Плашки здесь нет — она
          обязана нести смысл «это одно целое», а заголовок с лидом и так
          читаются как целое (DESIGN.md § Elevation). Нижний отступ равен
          расстоянию между блоками формы: шапка встаёт в общий ритм, а не
          отделяется от него провалом. */}
      <header className="pt-sm pb-2xl">
        <p className={hintText}>{screen.eyebrow}</p>
        <h1 className="mt-xs max-w-[20ch] text-heading tracking-heading font-semibold text-balance">
          {screen.title}
        </h1>
        {stage === 'form' && (
          <p className="mt-sm max-w-[54ch] text-body tracking-body text-on-surface-muted">
            {screen.lede}
          </p>
        )}
      </header>

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
            <Summary rows={rows} />
          </Section>
        </div>
      )}

      {/* Своего отступа у формы нет: расстояние до первого блока задаёт
          шапка, и оно равно расстоянию между блоками. Два отступа подряд
          давали провал в полтора ритма. */}
      {stage === 'form' && (
      <form onSubmit={submit}>
        <Section>
          <Ask title={screen.stepCategory}>
            <Rows>
              {categories.map((c) => (
                <div key={c.id} className={blockRowDivider}>
                  <label className={blockRow(category === c.id)}>
                    <input type="radio" name="category" value={c.id} className="sr-only"
                      checked={category === c.id}
                      onChange={() => { setCategory(c.id); setErrors({}); touched() }} />
                    {/* Иконка несёт содержание, а не украшает: категорию узнают
                        по предмету раньше, чем прочитают слово (§ Иконки). */}
                    <CategoryIcon id={c.id} />
                    <span className="min-w-0">
                      <span className={`block ${optLabel}`}>{c.label}</span>
                      <span className={`mt-xs block ${hintText}`}>{c.hint}</span>
                    </span>
                    <Dot on={category === c.id} />
                  </label>
                </div>
              ))}
            </Rows>
          </Ask>
        </Section>

        {category && (
          <>
            {/* Размер — общее поле всех категорий (контракт §2), спрашивается
                у всех; формулировка вопроса зависит от категории. */}
            <Section>
              <Ask plain title={mainSizeAsk(category).question} hint={mainSizeAsk(category).hint}>
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
                {/* «Пока не знаю» — короткое значение, ему место в чипсе,
                    а не в строке: строка на всю ширину ради двух слов
                    выглядит как ошибка вёрстки (§ Components). */}
                <label className={`${chip(sizeUnknown)} mt-lg`}>
                  <input type="checkbox" className="sr-only" checked={sizeUnknown}
                    onChange={(e) => { setSizeUnknown(e.target.checked); setErrors({ ...errors, size: undefined }); touched() }} />
                  <span className="whitespace-nowrap">{mainSize.unknownLabel}</span>
                </label>
                <Note id="size-note" error={errors.size}
                  hint={sizeUnknown ? mainSize.unknownNote : undefined} />
              </Ask>
            </Section>

            {isKitchen && (
              <>
                <Section>
                  <Ask title={kitchenShape.question} hint={kitchenShape.hint}>
                    {/* Чертёж занимает место иконки и встаёт в ту же колонку,
                        что иконки категорий: одна вертикаль на всю форму
                        (§ Do — колонка иконок и есть каркас блока). */}
                    <Rows>
                      {kitchenShape.options.map((o) => (
                        <div key={o.id} className={blockRowDivider}>
                          <label className={blockRow(shape === o.id)}>
                            <input type="radio" name="shape" value={o.id} className="sr-only"
                              checked={shape === o.id} onChange={() => { setShape(o.id); touched() }} />
                            <KitchenShape id={o.id} />
                            <span className="min-w-0">
                              <span className={`block ${optLabel}`}>{o.label}</span>
                              <span className={`mt-xs block ${hintText}`}>{o.hint}</span>
                            </span>
                            <Dot on={shape === o.id} />
                          </label>
                        </div>
                      ))}
                    </Rows>
                  </Ask>
                </Section>

                <Section>
                  <Ask title={kitchenAppliances.question} hint={kitchenAppliances.hint}>
                    {/* Три коротких ответа — чипсами: строка на всю ширину
                        ради двух слов растягивает блок впустую. */}
                    <div className="flex flex-wrap gap-sm">
                      {kitchenAppliances.options.map((o) => (
                        <label key={o.id} className={chip(appliances === o.id)}>
                          <input type="radio" name="appliances" value={o.id} className="sr-only"
                            checked={appliances === o.id} onChange={() => { setAppliances(o.id); touched() }} />
                          <span>{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </Ask>
                </Section>
              </>
            )}

            <Section>
              <Ask plain title={descriptionAsk.question} hint={descriptionAsk.hint}>
                <textarea id="description" rows={5} value={text}
                  placeholder={descriptionAsk.placeholder}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby="description-note"
                  onChange={(e) => { setText(e.target.value); setErrors({ ...errors, description: undefined }); touched() }}
                  className={`block w-full max-w-[62ch] resize-y ${field(Boolean(errors.description))}`} />
                <Note id="description-note" error={errors.description} />
              </Ask>
            </Section>

            {/* US-10. Обязательным не делается и в errors не попадает: фото
                просим настойчиво, но отправку оно не держит. */}
            <Section>
              <Ask title={photosAsk.question} hint={photosAsk.hint}>
                {photoList.length > 0 && (
                  <ul className="mb-lg grid grid-cols-3 gap-sm sm:grid-cols-5">
                    {photoList.map((photo) => (
                      <li key={photo.id} className="relative">
                        {/* Радиус 0: скруглённый угол отрезает предмет
                            и уводит масштаб (DESIGN.md § Shapes). */}
                        <img src={photo.url} alt={photo.name}
                          className="aspect-square w-full rounded-none object-cover" />
                        <button type="button" onClick={() => removePhoto(photo.id)}
                          aria-label={`${photosAsk.remove}: ${photo.name}`}
                          title={photosAsk.remove}
                          className="absolute top-xs right-xs flex size-6 items-center
                            justify-center rounded-sm bg-surface text-on-surface
                            transition-[filter] duration-100 hover:brightness-92">
                          <CloseIcon />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Поле скрыто визуально, но остаётся в порядке обхода —
                    значит обязано иметь имя, иначе диктор прочитает
                    «поле файла» без пояснения. */}
                <input ref={filePicker} type="file" multiple className="sr-only"
                  aria-label={photosAsk.add}
                  accept={PHOTO_MIME.join(',')}
                  onChange={(e) => { void addPhotos(e.target.files); e.target.value = '' }} />
                <button type="button" className={buttonText} disabled={photoBusy}
                  onClick={() => filePicker.current?.click()}>
                  {photoList.length > 0 ? photosAsk.addMore : photosAsk.add}
                </button>
              </Ask>
              {photoError && (
                <p role="alert" className={`mt-md ${errorTextClass}`}>{photoError}</p>
              )}
            </Section>

            <Section>
              <Ask title={cityAsk.question} hint={cityAsk.hint}>
                <div className="flex flex-wrap gap-sm">
                  {cityAsk.options.map((o) => (
                    <label key={o.id} className={chip(cityCode === o.id)}>
                      <input type="radio" name="city" id={`city-${o.id}`} value={o.id}
                        className="sr-only" checked={cityCode === o.id}
                        onChange={() => { setCityCode(o.id); setErrors({ ...errors, city: undefined }); touched() }} />
                      <span>{o.label}</span>
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
              <Ask plain title={phoneAsk.question} hint={phoneAsk.hint}>
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
              <Summary rows={rows} />

              {/* US-11. Чекбокса в системе нет вовсе, и заводить его здесь
                  нельзя — правка DESIGN.md отдельное решение. Согласие
                  собирается строкой блока с точкой выбора: отметка зелёная,
                  как и всякий выбор в системе. Ссылка на политику открывается
                  отдельной вкладкой, иначе заполненная форма теряется. */}
              <div className="mt-xl">
                <Rows>
                  <label className={blockRow(consentGiven)} htmlFor="consent">
                    <input type="checkbox" id="consent" className="sr-only"
                      checked={consentGiven}
                      onChange={(e) => {
                        setConsentGiven(e.target.checked)
                        setErrors({ ...errors, consent: undefined })
                        touched()
                      }} />
                    <span className="min-w-0">
                      <span className={`block ${optLabel}`}>{consentRow.label}</span>
                      <span className={`mt-xs block ${hintText}`}>{consentRow.hint}</span>
                    </span>
                    <Dot on={consentGiven} />
                  </label>
                </Rows>
                <p className="mt-md">
                  <a href="/privacy" target="_blank" rel="noreferrer" className={link}>
                    {consentRow.linkText}
                  </a>
                </p>
                <Note id="consent-note" error={errors.consent} />
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

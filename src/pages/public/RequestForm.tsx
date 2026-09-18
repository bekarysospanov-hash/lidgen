import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { requestSource, track } from '../../analytics'
import { isApiError } from '../../api/errors'
import { CategoryIcon } from '../../components/CategoryIcon'
import { CheckRows, ChoiceRows, Dot, Rows } from '../../components/Choice'
import { CameraIcon, CloseIcon } from '../../components/icons'
import { KitchenShape } from '../../components/KitchenShape'
import { WardrobeDoors } from '../../components/WardrobeDoors'
import { OtpConfirm } from '../../components/OtpConfirm'
import { PageShell } from '../../components/PageShell'
import { PhoneInput } from '../../components/PhoneInput'
import {
  blockRow,
  buttonFilled,
  buttonText,
  chip,
  errorTextClass,
  field,
  fieldLabel,
  hintText,
  link,
  panel,
  stepPanel,
} from '../../components/ui'
import {
  CeilingMeters,
  City,
  Description,
  MainSize,
  Meters,
  NicheDepthMeters,
  PHOTO_MAX_COUNT,
  PHOTO_MIME,
  Phone,
} from '../../contract'
import type {
  Appliance,
  BathroomBasin,
  BathroomMount,
  BathroomNeed,
  CityCode,
  CreateRequest,
  Details,
  KitchenUpper,
  MainSize as MainSizeValue,
  OtherKind,
  Photo,
  Readiness,
  RequestCreated,
  WardrobeInside,
  WardrobePlacement,
} from '../../contract'
import {
  applianceList as applianceAsk,
  bathroomBasin as basinAsk,
  bathroomMount as mountAsk,
  bathroomNeeds as needsAsk,
  bathroomWidth as bathWidthAsk,
  categories,
  ceilingHeight as ceilingAsk,
  city as cityAsk,
  kitchenUpper as upperAsk,
  kitchenWalls as wallsAsk,
  nicheDepth as nicheAsk,
  otherKind as otherKindAsk,
  readiness as readinessAsk,
  wardrobeInside as insideAsk,
  wardrobePlacement as placementAsk,
  description as descriptionAsk,
  district as districtAsk,
  finishLevel as finishAsk,
  photos as photosAsk,
  kitchenAppliances,
  kitchenShape,
  mainSize,
  mainSizeAsk,
  metersUnit,
  phone as phoneAsk,
  screen,
  summary,
  wardrobeCeiling,
  wardrobeDoors,
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
      {hint && <p className={`mt-xs max-w-measure ${hintText}`}>{hint}</p>}
      <div className={plain ? 'mt-md' : `${stepPanel} mt-md`}>{children}</div>
    </>
  )
}

/**
 * Числовое поле с подписью единицы справа. Ширина короткая — 10rem: поле
 * мерится тем, что в него пишут, а не тем, сколько осталось места
 * (DESIGN.md § Ширины полей ввода).
 */
function NumberAsk({ id, label, value, unit, placeholder, invalid, onChange }: {
  id: string
  label: string
  value: string
  unit: string
  /** Пример нужного числа. Без него поле молчит о том, какого вида ответ ждут. */
  placeholder: string
  invalid: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-baseline gap-sm">
      <input id={id} inputMode="decimal" autoComplete="off" aria-label={label}
        value={value} placeholder={placeholder}
        aria-invalid={invalid} aria-describedby={`${id}-note`}
        onChange={(e) => onChange(e.target.value)}
        className={`w-[10rem] tabular-nums ${field(invalid)}`} />
      <span className={hintText}>{unit}</span>
    </div>
  )
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
    <div className="mt-md max-w-measure">
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
            <dt className={`w-[10rem] shrink-0 ${hintText}`}>{k}</dt>
            <dd className="min-w-0 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Подпись варианта: подчёркивается при наведении на карточку. */
const optLabel = 'group-hover:underline underline-offset-4'

type DoorsId = (typeof wardrobeDoors.options)[number]['id']
type FinishId = (typeof finishAsk.options)[number]['id']
type ShapeId = (typeof kitchenShape.options)[number]['id']
type ApplianceId = (typeof kitchenAppliances.options)[number]['id']
type FieldKey =
  | 'size'
  | 'description'
  | 'city'
  | 'cityName'
  | 'phone'
  | 'consent'
  // Числа полного пути: необязательные, но введённое неверно —
  // ошибка, а не молчаливо отброшенное значение.
  | 'secondWall'
  | 'thirdWall'
  | 'ceiling'
  | 'nicheDepth'
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
  /**
   * US-08 — общие поля. Ни одно не блокирует отправку: спрашиваем настойчиво,
   * но заявка без них остаётся валидной (PRD, «обязательный минимум»).
   */
  /** US-06 — двери и высота шкафа. Как и у кухни, отправку не блокируют. */
  const [doors, setDoors] = useState<DoorsId | null>(null)
  const [toCeiling, setToCeiling] = useState<boolean | null>(null)
  // Полный путь (18.09): поля раскрываются следом за ответом на предыдущий
  // вопрос. Пустые значения законны — короткий путь остаётся коротким.
  const [secondWall, setSecondWall] = useState('')
  const [thirdWall, setThirdWall] = useState('')
  const [ceiling, setCeiling] = useState('')
  const [upper, setUpper] = useState<KitchenUpper | null>(null)
  const [applianceIds, setApplianceIds] = useState<Appliance[]>([])
  const [placement, setPlacement] = useState<WardrobePlacement | null>(null)
  const [nicheDepthValue, setNicheDepthValue] = useState('')
  const [insideIds, setInsideIds] = useState<WardrobeInside[]>([])
  const [mount, setMount] = useState<BathroomMount | null>(null)
  const [basin, setBasin] = useState<BathroomBasin | null>(null)
  const [needIds, setNeedIds] = useState<BathroomNeed[]>([])
  const [otherKindId, setOtherKindId] = useState<OtherKind | null>(null)
  const [readinessId, setReadinessId] = useState<Readiness | null>(null)
  const [finish, setFinish] = useState<FinishId | null>(null)
  const [district, setDistrict] = useState('')
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
  /**
   * Вопрос о размере зависит от категории: ванная мерится сантиметрами,
   * остальное — метрами вдоль стены (18.09).
   */
  const isBathroom = category === 'bathroom'
  const sizeAsk = isBathroom
    ? bathWidthAsk
    : { ...mainSizeAsk(category ?? 'other'), placeholder: mainSize.placeholder }

  /**
   * Развилка короткого и полного пути проходит здесь, поэтому здесь же
   * событие: без него отвал «нажал „пока не знаю“ и ушёл» неотличим
   * от «испугался числа и ушёл», а это разные диагнозы (контракт §2).
   *
   * Своей защиты от повторов нет — её держит `track`: события воронки
   * считаются один раз за сессию, и правка числа не новый ответ.
   */
  function answeredSize(known: boolean) {
    track('size_answered', { known })
  }

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
  /** Подпись выбранного варианта: сводка показывает слова, а не коды. */
  const pick = <T extends string>(options: readonly { id: T; label: string }[], id: T | null) =>
    id === null ? null : (options.find((o) => o.id === id)?.label ?? null)
  /** Отмеченное списком — через запятую, в порядке самого списка. */
  const picked = <T extends string>(options: readonly { id: T; label: string }[], ids: readonly T[]) =>
    options.filter((o) => ids.includes(o.id)).map((o) => o.label).join(', ')

  if (category) rows.push([L.category, categories.find((c) => c.id === category)!.label])
  const otherKindLabel = pick(otherKindAsk.options, otherKindId)
  if (otherKindLabel) rows.push([L.otherKind, otherKindLabel])
  const sizeLabel = isKitchen ? L.size : L.sizeOther
  if (sizeUnknown) rows.push([sizeLabel, L.sizeUnknown])
  else if (size.trim())
    rows.push([
      sizeLabel,
      isBathroom ? `${size.trim()} ${bathWidthAsk.unit}` : `${size.trim()} ${metersUnit(size)}`,
    ])
  if (shape) rows.push([L.shape, kitchenShape.options.find((o) => o.id === shape)!.label])
  if (secondWall.trim()) rows.push([L.secondWall, `${secondWall.trim()} ${metersUnit(secondWall)}`])
  if (thirdWall.trim()) rows.push([L.thirdWall, `${thirdWall.trim()} ${metersUnit(thirdWall)}`])
  const upperLabel = pick(upperAsk.options, upper)
  if (upperLabel) rows.push([L.upper, upperLabel])
  if (ceiling.trim()) rows.push([L.ceilingHeight, `${ceiling.trim()} ${metersUnit(ceiling)}`])
  if (appliances)
    rows.push([L.appliances, kitchenAppliances.options.find((o) => o.id === appliances)!.label])
  if (appliances === 'yes' && applianceIds.length > 0)
    rows.push([L.applianceList, picked(applianceAsk.options, applianceIds)])
  if (doors) rows.push([L.doors, wardrobeDoors.options.find((o) => o.id === doors)!.label])
  if (toCeiling !== null)
    rows.push([L.ceiling, wardrobeCeiling.options.find((o) => o.id === (toCeiling ? 'yes' : 'no'))!.label])
  const placementLabel = pick(placementAsk.options, placement)
  if (placementLabel) rows.push([L.placement, placementLabel])
  if (placement === 'niche' && nicheDepthValue.trim())
    rows.push([L.nicheDepth, `${nicheDepthValue.trim()} ${metersUnit(nicheDepthValue)}`])
  if (insideIds.length > 0) rows.push([L.inside, picked(insideAsk.options, insideIds)])
  const mountLabel = pick(mountAsk.options, mount)
  if (mountLabel) rows.push([L.mount, mountLabel])
  const basinLabel = pick(basinAsk.options, basin)
  if (basinLabel) rows.push([L.basin, basinLabel])
  if (needIds.length > 0) rows.push([L.needs, picked(needsAsk.options, needIds)])
  if (finish) rows.push([L.finish, finishAsk.options.find((o) => o.id === finish)!.label])
  const readinessLabel = pick(readinessAsk.options, readinessId)
  if (readinessLabel) rows.push([L.readiness, readinessLabel])
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
  /**
   * Число полного пути: пустое поле — не ошибка, эти вопросы необязательны.
   * Введено, но не разбирается схемой — ошибка: молча отбросить число,
   * которое человек написал, хуже, чем сказать про него.
   *
   * «Мягко принимать, строго отдавать» (DESIGN.md § Принципы): запятая
   * и точка равноправны на входе, наружу уходит одно число.
   */
  function optionalNumber(
    raw: string,
    schema: { safeParse: (value: unknown) => { success: boolean } },
    field: keyof FieldErrors,
    message: string,
    errors: FieldErrors,
  ): number | null {
    if (raw.trim().length === 0) return null
    const value = Number(raw.trim().replace(',', '.'))
    if (!Number.isFinite(value) || !schema.safeParse(value).success) {
      errors[field] = message
      return null
    }
    return Number(value.toFixed(2))
  }

  function build(chosen: CategoryId): { payload: CreateRequest } | { errors: FieldErrors } {
    const next: FieldErrors = {}

    let sizeValue: MainSizeValue | null = null
    // Ванная мерится сантиметрами: «восемьдесят сантиметров» — то, как человек
    // говорит про тумбу. В контракт уходят метры (§2, Meters).
    const sizeDivisor = chosen === 'bathroom' ? 100 : 1
    if (sizeUnknown) {
      sizeValue = { known: false }
    } else if (size.trim().length === 0) {
      next.size = mainSize.errorEmpty
    } else {
      const raw = Number(size.trim().replace(',', '.'))
      const meters = raw / sizeDivisor
      // Ванную спрашивают сантиметрами, а Meters проверяет метры — и «5 см»
      // проходило бы как 0,05 м. Границы проверяются в тех единицах, в каких
      // задан вопрос, иначе текст ошибки обещает то, чего никто не проверяет.
      const outOfRange = chosen === 'bathroom' && (!Number.isFinite(raw) || raw < 20 || raw > 300)
      const parsed = MainSize.safeParse({ known: true, meters: Number(meters.toFixed(2)) })
      if (parsed.success && !outOfRange) sizeValue = parsed.data
      else next.size = chosen === 'bathroom' ? bathWidthAsk.errorInvalid : mainSize.errorInvalid
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

    // Полный путь: заполнено то, что человек назвал, остальное — null.
    // Списки уходят как есть: повторы схема отклонит, а форма их не создаёт.
    const secondWallM = optionalNumber(secondWall, Meters, 'secondWall', wallsAsk.errorInvalid, next)
    const thirdWallM = optionalNumber(thirdWall, Meters, 'thirdWall', wallsAsk.errorInvalid, next)
    const ceilingM = optionalNumber(ceiling, CeilingMeters, 'ceiling', ceilingAsk.errorInvalid, next)
    const nicheDepthM = optionalNumber(
      nicheDepthValue, NicheDepthMeters, 'nicheDepth', nicheAsk.errorInvalid, next,
    )

    // Скрытое поле в заявку не уходит: человек поставил П-образную, вписал
    // третью стену, передумал на прямую — третьей стены у него нет, и
    // мебельщик не должен видеть данные, которых не было на экране при
    // отправке. Правило одно на все раскрывающиеся поля.
    const hasSecond = shape === 'corner' || shape === 'u-shape'
    const details: Details =
      chosen === 'kitchen'
        ? {
            category: 'kitchen',
            shape,
            appliances,
            secondWallM: hasSecond ? secondWallM : null,
            thirdWallM: shape === 'u-shape' ? thirdWallM : null,
            ceilingM,
            upper,
            // Список техники нужен только когда её встраивают: ответ «нет»
            // с отмеченной духовкой — противоречие, которого быть не должно.
            applianceList: appliances === 'yes' ? applianceIds : [],
          }
        : chosen === 'wardrobe'
          ? {
              category: 'wardrobe',
              doors,
              toCeiling,
              placement,
              nicheDepthM: placement === 'niche' ? nicheDepthM : null,
              // Высоту потолка спрашивают только у шкафа до потолка.
              ceilingM: toCeiling === true ? ceilingM : null,
              inside: insideIds,
            }
          : chosen === 'bathroom'
            ? { category: 'bathroom', mount, basin, needs: needIds }
            : { category: 'other', kind: otherKindId }

    if (!attemptId.current) attemptId.current = crypto.randomUUID()

    return {
      payload: {
        details,
        mainSize: sizeValue,
        description: parsedText.data,
        city: cityValue,
        phone: phoneValue,
        district: district.trim() || null,
        readiness: readinessId,
        finishLevel: finish,
        // US-10: снимки уходят как есть, включая пустой список. Проверять
        // их здесь нечего — каждый уже принят сервером при загрузке (§5).
        photos: photoList,
        // Версия текста и время отметки, а не булев флаг: доказывать придётся,
        // с чем именно человек согласился и когда (US-11).
        consent: { policyVersion: POLICY_VERSION, acceptedAt: new Date().toISOString() },
        // US-26: метки живут в памяти с момента входа — к отправке заявки
        // их в адресной строке уже нет.
        source: requestSource(),
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

    // US-25a: нажатие на кнопку — отдельный шаг воронки. Считается и тогда,
    // когда форма не прошла проверку: «дошёл до отправки, но не отправил» —
    // самое интересное место в воронке, и терять его нельзя.
    track('continue_clicked')

    // Ответ о размере висел только на уходе фокуса: человек, вписавший число
    // и сразу нажавший «Продолжить», события не порождал, и часть воронки
    // терялась (долг с 18.09). Повтор безопасен — `track` считает события
    // воронки один раз за сессию.
    answeredSize(!sizeUnknown && size.trim().length > 0)

    const result = build(category)
    if ('errors' in result) {
      setErrors(result.errors)
      setSendError(null)
      focusFirst(result.errors)
      return
    }

    // Обязательный минимум собран — форма прошла проверку целиком.
    track('required_filled')

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
        <h1 className="mt-xs max-w-measure-title text-heading tracking-heading font-semibold text-balance">
          {screen.title}
        </h1>
        {stage === 'form' && (
          <p className="mt-sm max-w-measure text-body tracking-body text-on-surface-muted">
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
            {/* Иконка несёт содержание, а не украшает: категорию узнают
                по предмету раньше, чем прочитают слово (§ Иконки). */}
            <ChoiceRows name="category" options={categories} value={category}
              icon={(id) => <CategoryIcon id={id} />}
              onPick={(id) => {
                setCategory(id)
                setErrors({})
                touched()
                track('category_selected', { category: id })
              }} />
          </Ask>
        </Section>

        {category && (
          <>
            {/* «Другое» раскрывается подкатегорией сразу, до размера: пока
                неизвестно, детская это или кладовая, вопрос о метрах вдоль
                стены задавать рано. Список по комнатам — так думает человек,
                который обставляет квартиру (решение PM 18.09). */}
            {category === 'other' && (
              <Section>
                <Ask title={otherKindAsk.question} hint={otherKindAsk.hint}>
                  <ChoiceRows name="otherKind" options={otherKindAsk.options} value={otherKindId}
                    onPick={(id) => { setOtherKindId(id); touched() }} />
                </Ask>
              </Section>
            )}

            {/* Размер — общее поле всех категорий (контракт §2), спрашивается
                у всех; формулировка вопроса зависит от категории. */}
            <Section>
              <Ask plain title={sizeAsk.question} hint={sizeAsk.hint}>
                <div className="flex items-baseline gap-sm">
                  {/* Заголовок вопроса стоит над блоком и служит меткой
                      глазами, но программно с полем не связан: диктор прочёл бы
                      «поле ввода» без имени. aria-label повторяет вопрос —
                      подпись остаётся одна, слышимая и видимая. */}
                  <input id="main-size" inputMode="decimal" autoComplete="off"
                    aria-label={sizeAsk.question}
                    value={size} disabled={sizeUnknown} placeholder={sizeAsk.placeholder}
                    aria-invalid={Boolean(errors.size)}
                    aria-describedby="size-note"
                    onChange={(e) => { setSize(e.target.value); setErrors({ ...errors, size: undefined }); touched() }}
                    onBlur={() => answeredSize(size.trim().length > 0)}
                    className={`w-[10rem] tabular-nums ${field(Boolean(errors.size))}`} />
                  {/* Подпись единицы склоняется по введённому: «3,2 метра».
                      Ванная мерится сантиметрами — там склонять нечего. */}
                  <span className={hintText}>
                    {isBathroom ? bathWidthAsk.unit : metersUnit(size)}
                  </span>
                </div>
                {/* «Пока не знаю» — короткое значение, ему место в чипсе,
                    а не в строке: строка на всю ширину ради двух слов
                    выглядит как ошибка вёрстки (§ Components). */}
                <label className={`${chip(sizeUnknown)} mt-lg`}>
                  <input type="checkbox" className="sr-only" checked={sizeUnknown}
                    onChange={(e) => {
                      setSizeUnknown(e.target.checked)
                      setErrors({ ...errors, size: undefined })
                      touched()
                      answeredSize(!e.target.checked)
                    }} />
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
                    <ChoiceRows name="shape" options={kitchenShape.options} value={shape}
                      icon={(id) => <KitchenShape id={id} />}
                      onPick={(id) => { setShape(id); touched() }} />
                  </Ask>
                </Section>

                {/* Полный путь раскрывается ПОСЛЕ формы кухни: вторая стена
                    существует только у угловой, третья — только у П-образной.
                    Спрашивать их раньше формы значило бы спрашивать о стене,
                    которой, может быть, нет. */}
                {(shape === 'corner' || shape === 'u-shape') && (
                  <Section>
                    <Ask plain title={wallsAsk.secondQuestion} hint={wallsAsk.secondHint}>
                      <NumberAsk id="second-wall" label={wallsAsk.secondQuestion}
                        value={secondWall} unit={metersUnit(secondWall)} placeholder={wallsAsk.placeholder}
                        invalid={Boolean(errors.secondWall)}
                        onChange={(v) => { setSecondWall(v); setErrors({ ...errors, secondWall: undefined }); touched() }} />
                      <Note id="second-wall-note" error={errors.secondWall} />
                    </Ask>
                  </Section>
                )}

                {shape === 'u-shape' && (
                  <Section>
                    <Ask plain title={wallsAsk.thirdQuestion}>
                      <NumberAsk id="third-wall" label={wallsAsk.thirdQuestion}
                        value={thirdWall} unit={metersUnit(thirdWall)} placeholder={wallsAsk.thirdPlaceholder}
                        invalid={Boolean(errors.thirdWall)}
                        onChange={(v) => { setThirdWall(v); setErrors({ ...errors, thirdWall: undefined }); touched() }} />
                      <Note id="third-wall-note" error={errors.thirdWall} />
                    </Ask>
                  </Section>
                )}

                <Section>
                  <Ask title={upperAsk.question} hint={upperAsk.hint}>
                    <ChoiceRows name="upper" options={upperAsk.options} value={upper}
                      onPick={(id) => { setUpper(id); touched() }} />
                  </Ask>
                </Section>

                <Section>
                  <Ask plain title={ceilingAsk.question} hint={ceilingAsk.hint}>
                    <NumberAsk id="ceiling" label={ceilingAsk.question}
                      value={ceiling} unit={metersUnit(ceiling)} placeholder={ceilingAsk.placeholder}
                      invalid={Boolean(errors.ceiling)}
                      onChange={(v) => { setCeiling(v); setErrors({ ...errors, ceiling: undefined }); touched() }} />
                    <Note id="ceiling-note" error={errors.ceiling} />
                  </Ask>
                </Section>

                <Section>
                  <Ask title={kitchenAppliances.question} hint={kitchenAppliances.hint}>
                    {/* Строками, а не чипсами (решение PM 18.09): «Нет,
                        отдельно стоящую» — 21 знак, и три пилюли разной длины
                        встают криво, с рваным правым краем. Отметка круглая:
                        выбирают одно из, и квадрат сказал бы, что можно
                        отметить несколько (§ Shapes). */}
                    <ChoiceRows name="appliances" options={kitchenAppliances.options}
                      value={appliances} onPick={(id) => { setAppliances(id); touched() }} />
                  </Ask>
                </Section>

                {/* Какая именно техника — только после «да, встроенную»:
                    список у того, кто ответил «нет», спрашивал бы о вещи,
                    которой не будет. */}
                {appliances === 'yes' && (
                  <Section>
                    <Ask title={applianceAsk.question} hint={applianceAsk.hint}>
                      <CheckRows options={applianceAsk.options} chosen={applianceIds}
                        onToggle={(id) => {
                          setApplianceIds((current) =>
                            current.includes(id)
                              ? current.filter((item) => item !== id)
                              : [...current, id])
                          touched()
                        }} />
                    </Ask>
                  </Section>
                )}
              </>
            )}

            {/* US-06. Двери картинками: «купе» и «распашные» человек
                различает глазами мгновенно, а словами путает. Вид спереди,
                а не сверху, как у кухни: шкаф узнают по фасаду. */}
            {category === 'wardrobe' && (
              <>
                <Section>
                  <Ask title={wardrobeDoors.question} hint={wardrobeDoors.hint}>
                    <ChoiceRows name="doors" options={wardrobeDoors.options} value={doors}
                      icon={(id) => <WardrobeDoors id={id} />}
                      onPick={(id) => { setDoors(id); touched() }} />
                  </Ask>
                </Section>

                <Section>
                  <Ask title={wardrobeCeiling.question} hint={wardrobeCeiling.hint}>
                    <ChoiceRows name="toCeiling" options={wardrobeCeiling.options}
                      value={toCeiling === null ? null : toCeiling ? 'yes' : 'no'}
                      onPick={(id) => { setToCeiling(id === 'yes'); touched() }} />
                  </Ask>
                </Section>

                {/* Высота потолка нужна только шкафу до потолка: у обычного
                    она на цену не влияет и была бы вопросом впустую. */}
                {toCeiling === true && (
                  <Section>
                    <Ask plain title={ceilingAsk.question} hint={ceilingAsk.hint}>
                      <NumberAsk id="wardrobe-ceiling" label={ceilingAsk.question}
                        value={ceiling} unit={metersUnit(ceiling)} placeholder={ceilingAsk.placeholder}
                        invalid={Boolean(errors.ceiling)}
                        onChange={(v) => { setCeiling(v); setErrors({ ...errors, ceiling: undefined }); touched() }} />
                      <Note id="wardrobe-ceiling-note" error={errors.ceiling} />
                    </Ask>
                  </Section>
                )}

                <Section>
                  <Ask title={placementAsk.question} hint={placementAsk.hint}>
                    <ChoiceRows name="placement" options={placementAsk.options} value={placement}
                      onPick={(id) => { setPlacement(id); touched() }} />
                  </Ask>
                </Section>

                {/* Единственная глубина, которую спрашивает продукт: ниша
                    ограничивает шкаф физически. У кухни и тумбы в ванной
                    глубину задаёт мастер (контракт §2). */}
                {placement === 'niche' && (
                  <Section>
                    <Ask plain title={nicheAsk.question} hint={nicheAsk.hint}>
                      <NumberAsk id="niche-depth" label={nicheAsk.question}
                        value={nicheDepthValue} unit={metersUnit(nicheDepthValue)} placeholder={nicheAsk.placeholder}
                        invalid={Boolean(errors.nicheDepth)}
                        onChange={(v) => { setNicheDepthValue(v); setErrors({ ...errors, nicheDepth: undefined }); touched() }} />
                      <Note id="niche-depth-note" error={errors.nicheDepth} />
                    </Ask>
                  </Section>
                )}

                <Section>
                  <Ask title={insideAsk.question} hint={insideAsk.hint}>
                    <CheckRows options={insideAsk.options} chosen={insideIds}
                      onToggle={(id) => {
                        setInsideIds((current) =>
                          current.includes(id)
                            ? current.filter((item) => item !== id)
                            : [...current, id])
                        touched()
                      }} />
                  </Ask>
                </Section>
              </>
            )}

            {/* ВАННАЯ. Ветка была заглушкой до 18.09: размер спрашивался,
                а всё остальное мебельщик угадывал. */}
            {category === 'bathroom' && (
              <>
                <Section>
                  <Ask title={mountAsk.question} hint={mountAsk.hint}>
                    <ChoiceRows name="mount" options={mountAsk.options} value={mount}
                      onPick={(id) => { setMount(id); touched() }} />
                  </Ask>
                </Section>

                <Section>
                  <Ask title={basinAsk.question} hint={basinAsk.hint}>
                    <ChoiceRows name="basin" options={basinAsk.options} value={basin}
                      onPick={(id) => { setBasin(id); touched() }} />
                  </Ask>
                </Section>

                <Section>
                  <Ask title={needsAsk.question} hint={needsAsk.hint}>
                    <CheckRows options={needsAsk.options} chosen={needIds}
                      onToggle={(id) => {
                        setNeedIds((current) =>
                          current.includes(id)
                            ? current.filter((item) => item !== id)
                            : [...current, id])
                        touched()
                      }} />
                  </Ask>
                </Section>
              </>
            )}

            <Section>
              <Ask plain title={descriptionAsk.question} hint={descriptionAsk.hint}>
                <textarea id="description" rows={5} value={text}
                  aria-label={descriptionAsk.question}
                  placeholder={descriptionAsk.placeholders[category]}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby="description-note"
                  onChange={(e) => { setText(e.target.value); setErrors({ ...errors, description: undefined }); touched() }}
                  className={`block w-full max-w-measure resize-y ${field(Boolean(errors.description))}`} />
                <Note id="description-note" error={errors.description} />
              </Ask>
            </Section>

            {/* Этап — необязательный вопрос и стоит ПОСЛЕ описания, а не
                перед формой (решение PM 18.09). Вопрос «знаете ли вы размеры»
                до того, как человек увидел, какие размеры спросят, — это
                ответ на воображаемый вопрос. Здесь же он читается как «что
                мне ответить»: мебельщик увидит этап в списке заявок. */}
            <Section>
              <Ask title={readinessAsk.question} hint={readinessAsk.hint}>
                <ChoiceRows name="readiness" options={readinessAsk.options} value={readinessId}
                  onPick={(id) => { setReadinessId(id); touched() }} />
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
                  <CameraIcon />
                  {photoList.length > 0 ? photosAsk.addMore : photosAsk.add}
                </button>
              </Ask>
              {photoError && (
                <p role="alert" className={`mt-md ${errorTextClass}`}>{photoError}</p>
              )}
            </Section>

            {/* US-08. Строки, а не картинки: снимков реальных работ ещё нет,
                они идут треком A вместе с каталогом. Место под них
                оставлено — заменятся так же, как схемы форм кухни. */}
            <Section>
              <Ask title={finishAsk.question} hint={finishAsk.hint}>
                <ChoiceRows name="finish" options={finishAsk.options} value={finish}
                  onPick={(id) => { setFinish(id); touched() }} />
              </Ask>
            </Section>

            <Section>
              <Ask title={cityAsk.question} hint={cityAsk.hint}>
                <ChoiceRows name="city" options={cityAsk.options} value={cityCode}
                  onPick={(id) => {
                    setCityCode(id)
                    setErrors({ ...errors, city: undefined })
                    touched()
                  }} />
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
                      className={`mt-sm block w-full max-w-[20rem] ${field(Boolean(errors.cityName))}`} />
                  </div>
                )}
                {/* ЖК или район. Отправку не блокирует, но по нему проверяется
                    сегмент: новосёлы в новостройках, а не «кто угодно из
                    города» (US-08, сценарий «район сохраняется»). */}
                <div className="mt-lg">
                  <label htmlFor="district" className={`block ${fieldLabel}`}>
                    {districtAsk.label}
                  </label>
                  <input id="district" autoComplete="address-level3" value={district}
                    placeholder={districtAsk.placeholder}
                    aria-describedby="district-note"
                    onChange={(e) => { setDistrict(e.target.value); touched() }}
                    className={`mt-sm block w-full max-w-[20rem] ${field()}`} />
                  <p id="district-note" className={`mt-sm ${hintText}`}>{districtAsk.hint}</p>
                </div>
                <Note id="city-note" error={errors.city ?? errors.cityName} />
              </Ask>
            </Section>

            <Section>
              <Ask plain title={phoneAsk.question} hint={phoneAsk.hint}>
                <PhoneInput id="phone" value={phoneDigits} label={phoneAsk.question}
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
                <div className="mt-md max-w-measure">
                  {sendError && <p role="alert" className={errorTextClass}>{sendError}</p>}
                  {!sendError && <p className={hintText}>{screen.submitHint}</p>}
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

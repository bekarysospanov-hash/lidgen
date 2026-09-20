// US-02 — витрина мастерских, она же главная с 20.09.
//
// Это страница поиска, а не рассказ о сервисе: заголовок и лид отсюда убраны
// (решение PM), потому что первый экран обязан начинаться списком. Рассказ
// живёт на /promo, ссылка на него — в подвале.
//
// Показываем только тех, кто дал согласие и чью карточку заполнили мы
// (трек A2): сгенерированные карточки, чужие портфолио и вымышленные
// мастерские «для объёма» запрещены PRD и контрактом. Пока согласий нет,
// каталог пуст — и это законное состояние, а не ошибка.
//
// Отбор живёт в адресе, а не в памяти вкладки: человек уходит в карточку
// и возвращается кнопкой браузера, и терять его выбор на этом переходе нельзя.
//
// Строка поиска — там же, и это проверено на утечку (ревью 20.09). Поле
// свободное, и написать в него можно что угодно, поэтому вопрос разбирался
// отдельно: `?q=` не уходит на сторонние домены — страница пришпилена
// `referrer: strict-origin-when-cross-origin`, и за пределы своего origin
// отдаётся только origin, без пути и параметров. Аналитика читает из адреса
// одни `utm_*` (`analytics.ts:31`). Остаётся история браузера на телефоне
// самого человека — обычная цена поиска, который переживает возврат.
// Запись идёт с `replace`, так что историю запрос не копит.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { MasterTile } from '../../components/MasterTile'
import { PageShell } from '../../components/PageShell'
import { FiltersIcon } from '../../components/icons'
import { buttonFilled, buttonText, chip, field, hintText, shelf } from '../../components/ui'
import { CategoryId, CityCode, type MasterCardPublic } from '../../contract'
import { cityName } from '../../questions/categories'
import { mastersPage } from '../../texts/masters'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; masters: MasterCardPublic[] }
  | { kind: 'failed' }

/** Города каталога. «Другой город» сюда не попадает: мастерских там нет. */
const CITIES: readonly CityCode[] = ['almaty', 'astana', 'shymkent']
const KINDS: readonly CategoryId[] = ['kitchen', 'wardrobe', 'bathroom', 'other']

/**
 * Ряд отбора — чипсы. Ровно тот случай, который система разрешает: значений
 * не больше пяти, самое длинное короче 22 знаков (§ Components). Первый
 * чипс — «всё равно»: снять отбор должно быть так же легко, как поставить.
 */
function FilterRow<T extends string>({ label, options, value, allLabel, onPick }: {
  label: string
  options: readonly { id: T; label: string }[]
  value: T | null
  allLabel: string
  onPick: (id: T | null) => void
}) {
  return (
    <div className="mt-lg first:mt-0">
      <p className={hintText}>{label}</p>
      <ul className="mt-sm flex flex-wrap gap-sm">
        <li>
          <button type="button" className={chip(value === null)} onClick={() => onPick(null)}>
            {allLabel}
          </button>
        </li>
        {options.map((option) => (
          <li key={option.id}>
            <button type="button" className={chip(value === option.id)}
              onClick={() => onPick(option.id)}>
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Masters() {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [params, setParams] = useSearchParams()
  /**
   * Отбор свёрнут по умолчанию и раскрывается стадией той же страницы,
   * а не окном поверх: модальных окон в системе нет (§ Layout). Свёрнутым
   * он начинает потому, что два ряда чипсов занимали на телефоне весь
   * первый экран — до первой плитки приходилось листать.
   */
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    api.listMasters().then(
      (masters) => setView({ kind: 'ready', masters }),
      () => setView({ kind: 'failed' }),
    )
  }, [attempt])

  // Значения из адреса — чужой ввод, и проверяются схемой: «?city=лол»
  // не должен ни падать, ни показывать пустой каталог как настоящий.
  const cityParam = CityCode.safeParse(params.get('city'))
  const kindParam = CategoryId.safeParse(params.get('kind'))
  const city = cityParam.success && cityParam.data !== 'other' ? cityParam.data : null
  const kind = kindParam.success ? kindParam.data : null
  const query = params.get('q') ?? ''

  function pick(key: 'city' | 'kind' | 'q', value: string | null) {
    const next = new URLSearchParams(params)
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
    // replace: отбор не должен копиться в истории — иначе кнопка «назад»
    // из карточки возвращает не в каталог, а на предыдущий фильтр.
    setParams(next, { replace: true })
  }

  if (view.kind === 'loading') {
    return (
      <PageShell layout="shelf">
        <p className="text-body tracking-body" role="status">{mastersPage.loading}</p>
      </PageShell>
    )
  }

  if (view.kind === 'failed') {
    return (
      <PageShell layout="shelf">
        <h1 className="text-heading tracking-heading font-semibold">{mastersPage.failedTitle}</h1>
        <button type="button" onClick={() => { setView({ kind: 'loading' }); setAttempt((n) => n + 1) }}
          className={`mt-xl ${buttonFilled}`}>
          {mastersPage.retry}
        </button>
      </PageShell>
    )
  }

  // Каталог пуст по существу: согласий нет ни у кого. Поиск и отбор в этом
  // состоянии не показываются — искать нечего, и строка над пустотой
  // обещала бы, что за ней кто-то есть.
  if (view.masters.length === 0) {
    return (
      <PageShell layout="shelf">
        <h1 className="text-heading tracking-heading font-semibold">{mastersPage.emptyTitle}</h1>
        <p className="mt-lg max-w-measure text-body tracking-body">{mastersPage.emptyBody}</p>
        <Link to="/request" className={`mt-xl inline-flex ${buttonFilled}`}>
          {mastersPage.toRequest}
        </Link>
      </PageShell>
    )
  }

  /**
   * Отбор по направлениям идёт по отмеченным категориям карточки, а не по
   * снимкам и не по строке «Делает»: снимки отсекали тех, кто делает, но
   * не сфотографировал, а свободная строка не совпадает сама с собой —
   * «кухни под ключ» и «Кухни» разные строки.
   *
   * Поиск смотрит имя и направления: это то, что человек набирает, когда
   * ищет знакомую мастерскую или «шкаф».
   */
  const needle = query.trim().toLowerCase()
  const shown = view.masters.filter((master) => {
    const byCity = city === null || master.city.code === city
    const byKind = kind === null || master.card.categories.includes(kind)
    const byQuery =
      needle === '' ||
      master.name.toLowerCase().includes(needle) ||
      master.card.does.some((item) => item.toLowerCase().includes(needle))
    return byCity && byKind && byQuery
  })

  const activeFilters = (city === null ? 0 : 1) + (kind === null ? 0 : 1)

  return (
    <PageShell layout="shelf">
      {/* Строка поиска и кнопка отбора — один ряд, как на любой витрине.
          Поле во всю ширину, кнопка прижата к правому краю: под большой
          палец (§ Layout). */}
      <div className="flex items-center gap-sm">
        <input
          value={query}
          onChange={(event) => pick('q', event.target.value)}
          aria-label={mastersPage.searchPlaceholder}
          placeholder={mastersPage.searchPlaceholder}
          className={`block w-full ${field()}`} />
        <button type="button"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
          className={`shrink-0 gap-sm ${chip(activeFilters > 0 || filtersOpen)}`}>
          <FiltersIcon />
          <span className="hidden sm:inline">
            {activeFilters > 0 ? mastersPage.filtersCount(activeFilters) : mastersPage.filtersAction}
          </span>
          <span className="sr-only sm:hidden">{mastersPage.filtersAction}</span>
          {activeFilters > 0 && <span className="sm:hidden tabular-nums">{activeFilters}</span>}
        </button>
      </div>

      {filtersOpen && (
        <section className="mt-lg">
          <FilterRow label={mastersPage.filterKindLabel} allLabel={mastersPage.filterAll}
            value={kind}
            options={KINDS.map((id) => ({ id, label: mastersPage.filterKinds[id] }))}
            onPick={(id) => pick('kind', id)} />
          <FilterRow label={mastersPage.filterCityLabel} allLabel={mastersPage.filterAllCities}
            value={city}
            options={CITIES.map((id) => ({ id, label: cityName({ code: id, name: null }) }))}
            onPick={(id) => pick('city', id)} />
          <p className="mt-lg">
            <button type="button" className={buttonText} onClick={() => setFiltersOpen(false)}>
              {mastersPage.filtersHide}
            </button>
          </p>
        </section>
      )}

      {shown.length === 0 ? (
        // Ничего не нашлось — это не пустой каталог: мастерские есть.
        // Человека нельзя оставлять в тупике, поэтому рядом сброс.
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">
            {needle === '' ? mastersPage.filterEmptyTitle : mastersPage.searchEmptyTitle}
          </h2>
          <p className="mt-sm max-w-measure text-body tracking-body">
            {needle === '' ? mastersPage.filterEmptyBody : mastersPage.searchEmptyBody}
          </p>
          <p className="mt-lg">
            <button type="button" className={buttonText}
              onClick={() => setParams({}, { replace: true })}>
              {mastersPage.filterReset}
            </button>
          </p>
        </section>
      ) : (
        <>
          {/* Одна строка на весь верх витрины: слева вход в лидген, справа
              счётчик. Пояснение «опишите задачу один раз…» отсюда снято
              (решение PM 20.09) — витрина обязана начинаться списком,
              а не абзацем о сервисе; тот же смысл человек читает на форме.
              Главное действие стоит не в конце экрана, и это названное
              отступление от § Порядок: ниже кнопки — сетка на сотню плиток,
              и «в конце» означало бы «нигде». */}
          <div className="mt-lg flex flex-wrap items-center gap-sm">
            <Link to="/request" className={`whitespace-nowrap ${buttonFilled}`}>
              {mastersPage.fanAction}
            </Link>
            {/* Число названо всегда: молчаливо укороченный список человек
                принимает за весь каталог. */}
            <p className={`ml-auto ${hintText}`} role="status">
              {mastersPage.found(shown.length)}
            </p>
          </div>

          <ul className={`mt-lg ${shelf}`}>
            {shown.map((master) => (
              <li key={master.id} className="flex">
                <MasterTile master={master} />
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  )
}

// US-02 — каталог мастерских. Показывает только тех, кто дал согласие
// и чью карточку заполнили мы (трек A2): сгенерированные карточки, чужие
// портфолио и вымышленные мастерские «для объёма» запрещены PRD и контрактом.
//
// Пока согласий нет, каталог пуст — и это законное состояние, а не ошибка.
// Пустая сетка и карточки-заглушки не показываются: человек должен видеть
// причину словами, иначе он решит, что сервис мёртв.
//
// Отбор — два вопроса, которые заказчик задаёт первыми: делают ли нужное мне
// и в моём ли городе (бенчмарк мебельных площадок, 18.09). Он живёт в адресе,
// а не в памяти вкладки: человек уходит в карточку и возвращается кнопкой
// браузера, и терять его выбор на этом переходе нельзя.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { MasterListCard } from '../../components/MasterListCard'
import { PageShell } from '../../components/PageShell'
import { buttonFilled, buttonText, chip, hintText } from '../../components/ui'
import { CategoryId, CityCode, type MasterCardPublic } from '../../contract'
import { cityName } from '../../questions/categories'
import { mastersPage } from '../../texts/masters'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; masters: MasterCardPublic[] }
  | { kind: 'failed' }

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-heading tracking-heading font-semibold">{children}</h1>
}

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

  function pick(key: 'city' | 'kind', value: string | null) {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    // replace: отбор не должен копиться в истории — иначе кнопка «назад»
    // из карточки возвращает не в каталог, а на предыдущий фильтр.
    setParams(next, { replace: true })
  }

  if (view.kind === 'loading') {
    return (
      <PageShell>
        <p className="text-body tracking-body" role="status">{mastersPage.loading}</p>
      </PageShell>
    )
  }

  if (view.kind === 'failed') {
    return (
      <PageShell>
        <Title>{mastersPage.failedTitle}</Title>
        <button type="button" onClick={() => { setView({ kind: 'loading' }); setAttempt((n) => n + 1) }}
          className={`mt-xl ${buttonFilled}`}>
          {mastersPage.retry}
        </button>
      </PageShell>
    )
  }

  // Каталог пуст по существу: согласий нет ни у кого. Отбор в этом состоянии
  // не показывается — фильтровать нечего, и ряд чипсов над пустотой обещал бы,
  // что за ним кто-то есть.
  if (view.masters.length === 0) {
    return (
      <PageShell>
        <Title>{mastersPage.emptyTitle}</Title>
        <p className="mt-lg max-w-measure text-body tracking-body">{mastersPage.emptyBody}</p>
        <Link to="/request" className={`mt-xl inline-flex ${buttonFilled}`}>
          {mastersPage.toRequest}
        </Link>
      </PageShell>
    )
  }

  /**
   * Отбор идёт по отмеченным направлениям карточки, а не по снимкам и не по
   * строке «Делает». Снимки были первой попыткой и отсекали лишнее: мастерская
   * делает ванные, но не сняла их — и выпадала из отбора (разбор с PM, 18.09).
   * Свободная строка не годится с другой стороны: «кухни под ключ» и «Кухни»
   * не совпадут никогда.
   */
  const shown = view.masters.filter(
    (master) =>
      (city === null || master.city.code === city) &&
      (kind === null || master.card.categories.includes(kind)),
  )

  return (
    <PageShell>
      <Title>{mastersPage.title}</Title>
      <p className="mt-lg max-w-measure text-body tracking-body">{mastersPage.lede}</p>

      <section className="mt-2xl">
        <FilterRow label={mastersPage.filterKindLabel} allLabel={mastersPage.filterAll}
          value={kind}
          options={KINDS.map((id) => ({ id, label: mastersPage.filterKinds[id] }))}
          onPick={(id) => pick('kind', id)} />
        <FilterRow label={mastersPage.filterCityLabel} allLabel={mastersPage.filterAllCities}
          value={city}
          options={CITIES.map((id) => ({ id, label: cityName({ code: id, name: null }) }))}
          onPick={(id) => pick('city', id)} />
      </section>

      {shown.length === 0 ? (
        // Отбор не дал никого — это не пустой каталог: мастерские есть.
        // Человека нельзя оставлять в тупике, поэтому рядом сброс и выход
        // на форму: заявка уйдёт по городу заявки, а не по этому отбору.
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">
            {mastersPage.filterEmptyTitle}
          </h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{mastersPage.filterEmptyBody}</p>
          <p className="mt-lg">
            <button type="button" className={buttonText}
              onClick={() => setParams({}, { replace: true })}>
              {mastersPage.filterReset}
            </button>
          </p>
          <Link to="/request" className={`mt-lg inline-flex ${buttonFilled}`}>
            {mastersPage.toRequest}
          </Link>
        </section>
      ) : (
        <>
          {/* Число названо всегда: молчаливо укороченный список человек
              принимает за весь каталог. */}
          <p className={`mt-xl ${hintText}`} role="status">
            {mastersPage.found(shown.length)}
          </p>

          <ul className="mt-lg flex flex-col gap-xl">
            {shown.map((master) => (
              <li key={master.id}>
                <MasterListCard master={master} />
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  )
}

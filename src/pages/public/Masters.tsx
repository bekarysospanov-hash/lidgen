// US-02 — каталог мастерских. Показывает только тех, кто дал согласие
// и чью карточку заполнили мы (трек A2): сгенерированные карточки, чужие
// портфолио и вымышленные мастерские «для объёма» запрещены PRD и контрактом.
//
// Пока согласий нет, каталог пуст — и это законное состояние, а не ошибка.
// Пустая сетка и карточки-заглушки не показываются: человек должен видеть
// причину словами, иначе он решит, что сервис мёртв.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { PageShell } from '../../components/PageShell'
import { buttonFilled, hintText, link, panel } from '../../components/ui'
import type { MasterCardPublic } from '../../contract'
import { cityName } from '../../questions/categories'
import { mastersPage } from '../../texts/masters'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; masters: MasterCardPublic[] }
  | { kind: 'failed' }

function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="text-heading tracking-heading font-semibold">{children}</h1>
}

/**
 * Карточка в списке — краткая: что умеет вместо цены (US-02) и один снимок.
 * Полностью карточка раскрывается по ссылке (US-03): семь мастерских по шесть
 * фотографий и шестьсот знаков текста превращают каталог в ленту, которую
 * никто не дочитывает, а витрина доверия должна читаться за один экран.
 */
function MasterCardView({ master }: { master: MasterCardPublic }) {
  return (
    <div className={panel}>
      <p className="text-subheading tracking-subheading font-medium">{master.name}</p>
      <p className={`mt-xs ${hintText}`}>
        {cityName(master.city)} · {mastersPage.yearsLabel(master.card.yearsOnMarket)}
      </p>

      <p className={`mt-lg ${hintText}`}>{mastersPage.doesLabel}</p>
      <p className="mt-xs text-body tracking-body">{master.card.does.join(' · ')}</p>

      {/* Первый снимок — радиус 0, своя работа (§ Shapes, US-02). Остальные
          в карточке: список показывает, что мастерская живая, а не всё о ней. */}
      {master.card.photos[0] !== undefined && (
        <img src={master.card.photos[0]} alt="" className="mt-lg aspect-[3/2] w-full object-cover" />
      )}

      <p className="mt-lg">
        <Link to={`/masters/${master.id}`} className={link}>
          {mastersPage.openCard}
        </Link>
      </p>
    </div>
  )
}

export default function Masters() {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    api.listMasters().then(
      (masters) => setView({ kind: 'ready', masters }),
      () => setView({ kind: 'failed' }),
    )
  }, [attempt])

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

  return (
    <PageShell>
      <Title>{mastersPage.title}</Title>
      <p className="mt-lg max-w-measure text-body tracking-body">{mastersPage.lede}</p>

      <ul className="mt-3xl flex flex-col gap-xl">
        {view.masters.map((master) => (
          <li key={master.id}>
            <MasterCardView master={master} />
          </li>
        ))}
      </ul>
    </PageShell>
  )
}

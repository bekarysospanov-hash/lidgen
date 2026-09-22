// US-18 — список заявок в кабинете мебельщика. Ради этого экрана собирается
// вторая половина среза 1: заявка, дошедшая до телефона Марата, и есть
// «момент истины скелета» (docs/story-map.md).
//
// Данные — проекция RequestForMasterListItem (контракт §5б): без описания,
// без снимков и без телефона. Телефон заказчицы сюда не приходит вовсе,
// и это требование ПДн, а не решение экрана (§7).
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { MasterShell } from '../../components/MasterShell'
import { CategoryIcon } from '../../components/CategoryIcon'
import { ChevronIcon } from '../../components/icons'
import {
  blockRow,
  blockRowDivider,
  buttonFilled,
  hintText,
  stepPanel,
} from '../../components/ui'
import type { Session, RequestForMasterListItem } from '../../contract'
import { categories, metersUnit } from '../../questions/categories'
import { city as cityQuestion } from '../../questions/categories'
import { errorText } from '../../texts/request'
import { requestsPage, routedAtLabel } from '../../texts/master'
import { clearSession, hasRole, readSession } from '../../session'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; items: RequestForMasterListItem[] }
  | { kind: 'network' }
  | { kind: 'failed'; message: string }

const categoryLabel = (id: RequestForMasterListItem['category']): string =>
  categories.find((category) => category.id === id)?.label ?? ''

const cityLabel = (code: string, name: string | null): string =>
  name ?? cityQuestion.options.find((option) => option.id === code)?.label ?? ''

/** Заголовок экрана: 30/600, обычным регистром (§ Typography). */
function Title({ children }: { children: React.ReactNode }) {
  return <h1 className="font-display text-heading tracking-heading font-bold">{children}</h1>
}

/**
 * Строка блока: иконка категории 32 слева, название, подсказка снизу,
 * шеврон справа — строка ведёт на карточку заявки (§ Components).
 * Собственного фона у строки нет, она лежит на плашке и отделена линией.
 */
function RequestRow({ item }: { item: RequestForMasterListItem }) {
  const size = item.mainSize.known
    ? `${String(item.mainSize.meters).replace('.', ',')} ${metersUnit(item.mainSize.meters)}`
    : requestsPage.sizeUnknown

  // Настоящие числа и имена вместо обобщений (§ Presence): когда пришла,
  // куда ехать, есть ли снимки — по этому мебельщик решает, берётся ли он.
  //
  // Две строки, а не одна склейка из четырёх кусков (правка 20.09). Пока
  // всё шло через « · » подряд, на 375 получалось три рваные строки, где
  // время, этап, город и снимки перетекали друг в друга без разбора.
  // Теперь верхняя отвечает «куда ехать», нижняя — «когда пришла и
  // насколько человек готов».
  const where = [
    [cityLabel(item.city.code, item.city.name), item.district].filter(Boolean).join(', '),
    item.photosCount > 0 ? requestsPage.photos(item.photosCount) : null,
  ].filter(Boolean)
  const when = [
    routedAtLabel(item.routedAt),
    // Этап стоит рядом со временем не случайно: заявка без числа с пометкой
    // «пока прикидывает» читается как понятный случай, а не как недоделка,
    // и мебельщик решает по строке, не открывая её (решение PM 18.09).
    item.readiness === 'ready'
      ? requestsPage.readinessReady
      : item.readiness === 'planning'
        ? requestsPage.readinessPlanning
        : null,
  ].filter(Boolean)

  return (
    <div className={blockRowDivider()}>
      {/* Метка повторяет суть строки, а не только номер: aria-label
          перекрывает текст внутри ссылки, и без категории с размером диктор
          читал бы «открыть заявку 2609-004» — какую именно, неизвестно. */}
      <Link
        to={`/master/requests/${item.id}`}
        aria-label={`${categoryLabel(item.category)}, ${size} — ${requestsPage.openRequest} ${item.number}`}
        className={blockRow(false)}
      >
        {/* Колонка иконок — каркас блока (§ Components). У строки с двумя
            строками текста иконка обязана стоять против названия, а не
            плавать посередине: иначе колонка держит пустоту. */}
        <span className="self-start">
          <CategoryIcon id={item.category} />
        </span>
        <span className="min-w-0 flex-1">
          {/* Шильдика «отвечено» здесь нет намеренно: строка уже лежит
              в разделе «Вы ответили», и отметка повторяла бы его заголовок. */}
          <span className="block text-body tracking-body font-medium">
            {categoryLabel(item.category)}, {size}
          </span>
          <span className={`mt-xs block ${hintText}`}>{where.join(' · ')}</span>
          <span className={`block tabular-nums ${hintText}`}>{when.join(' · ')}</span>
        </span>
        <ChevronIcon />
      </Link>
    </div>
  )
}

/** Раздел списка: заголовок стоит СНАРУЖИ плашки и называет её. */
function RequestGroup({ title, items }: { title: string; items: RequestForMasterListItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="mt-3xl">
      <h2 className="text-subheading tracking-subheading font-medium">{title}</h2>
      <div className={`mt-lg ${stepPanel} py-sm`}>
        {items.map((item) => (
          <RequestRow key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export default function MasterRequests() {
  const [session, setSession] = useState<Session | null>(() => readSession())
  const [view, setView] = useState<View>({ kind: 'loading' })

  /**
   * Загрузка не переводит экран в «загружаем» сама: при первом заходе он
   * там и так, а повторная попытка ставит это состояние из обработчика
   * нажатия. Синхронный setState внутри эффекта запускал бы лишний проход
   * рендера — линтер справедливо на это ругается.
   */
  const load = useCallback((token: string) => {
    api.listRequestsForMaster(token).then(
      (items) => setView({ kind: 'ready', items }),
      (caught: unknown) => {
        if (!isApiError(caught)) return setView({ kind: 'failed', message: errorText.INTERNAL })
        // Сессия протухла или отозвана — экран не показывает чужих данных
        // и не притворяется, что список пуст: он возвращает ко входу.
        if (caught.code === 'MASTER_UNAUTHORIZED') {
          clearSession()
          setSession(null)
          return
        }
        if (caught.code === 'NETWORK') return setView({ kind: 'network' })
        setView({ kind: 'failed', message: errorText[caught.code] })
      },
    )
  }, [])

  // Без сессии эффект не ходит никуда, а экран входа выводится по самому
  // отсутствию сессии — состояние «не вошёл» выводимо из session и хранить
  // его вторым источником незачем.
  useEffect(() => {
    if (!session) return
    load(session.token)
  }, [session, load])

  // Не вошёл — на экран входа, а не на пустой кабинет с объяснением,
  // почему он пуст (US-17).
  // Гейт по роли, а не по факту входа (§5в): вошедший заказчик
  // не должен снова видеть форму входа — он уже вошёл.
  if (!hasRole(session, 'master')) return <Navigate to="/master" replace />

  if (view.kind === 'loading') {
    return (
      <MasterShell masterName={session.master?.name}>
        <p className="text-body tracking-body" role="status">
          {requestsPage.loading}
        </p>
      </MasterShell>
    )
  }

  if (view.kind === 'network' || view.kind === 'failed') {
    const network = view.kind === 'network'
    return (
      <MasterShell masterName={session.master?.name}>
        <Title>{network ? requestsPage.networkTitle : requestsPage.failedTitle}</Title>
        <p className="mt-lg max-w-measure text-body tracking-body">
          {network ? requestsPage.networkBody : view.message}
        </p>
        <button
          type="button"
          onClick={() => {
            setView({ kind: 'loading' })
            load(session.token)
          }}
          className={`mt-xl ${buttonFilled}`}
        >
          {requestsPage.retry}
        </button>
      </MasterShell>
    )
  }

  const waiting = view.items.filter((item) => !item.quotedByMe)
  const answered = view.items.filter((item) => item.quotedByMe)

  return (
    <MasterShell masterName={session.master?.name}>
      <Title>{requestsPage.title}</Title>

      {view.items.length === 0 ? (
        // Пустое состояние говорит словами, а не серым прямоугольником
        // (§ Presence). На скелете оно будет встречаться чаще полного.
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">
            {requestsPage.emptyTitle}
          </h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{requestsPage.emptyBody}</p>
        </section>
      ) : (
        <>
          <RequestGroup title={requestsPage.waitingTitle} items={waiting} />
          <RequestGroup title={requestsPage.answeredTitle} items={answered} />
        </>
      )}
    </MasterShell>
  )
}

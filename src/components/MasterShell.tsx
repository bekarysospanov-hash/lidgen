// Оболочка кабинета мебельщика. Отдельно от PageShell, потому что зоны
// разные: у заказчицы в шапке «Заявка» и «Мастерские» — переходы, которые
// Марату не нужны и сбивают, а у него в шапке стоит то, чего нет у неё, —
// имя его мастерской. Общее — знак, колонка до 1440 и отсутствие липкости
// (DESIGN.md § Layout).
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { shell } from '../texts/shell'
import { masterShell } from '../texts/master'
import { BrandMark } from './icons'
import { hintText, link } from './ui'
import { api } from '../api/client'
import { clearSession, readSession } from '../session'

const brandLink =
  'flex min-h-target items-center gap-sm whitespace-nowrap text-subheading tracking-subheading ' +
  'font-medium text-on-brand underline-offset-4 hover:underline'

/**
 * Выход стоит в залитой брендом полосе, и надпись там белая: графит
 * на коричневом не читается (§ Components, «шапка бренда», 22.09).
 */
const signOutOnBrand =
  'inline-flex min-h-target items-center justify-center rounded-sm px-sm ' +
  'text-label tracking-label font-medium text-on-brand underline underline-offset-4 ' +
  'transition-[filter] duration-100 hover:brightness-92'

/**
 * Пункт кабинета. Тот, на котором стоим, — не ссылка, а приглушённая
 * подпись: ссылка на саму себя ничего не делает, а синим цветом обещает
 * переход.
 *
 * Ступень body-sm, а не body: навигация называет то же слово, что заголовок
 * экрана под ней («Заявки» и «Заявки»), и в одном кегле они читались как
 * дубль — человек ищет между ними разницу, которой нет (чек-лист, п. 3).
 * Полоска служебная, заголовок главный; так они не спорят.
 *
 * Цель нажатия 44 по обеим сторонам (§ Размер цели): кабинет открывают
 * с телефона, стоя в цехе.
 */
function AreaLink({ to, current, children }: {
  to: string
  current: boolean
  children: React.ReactNode
}) {
  const shape = 'flex min-h-target items-center text-body-sm tracking-body-sm'
  if (current) {
    return <span aria-current="page" className={`${shape} text-on-surface-muted`}>{children}</span>
  }
  return <Link to={to} className={`${shape} ${link}`}>{children}</Link>
}

export function MasterShell({
  masterName,
  children,
}: {
  /** Кто вошёл. Настоящее имя мастерской, а не «личный кабинет» вообще. */
  masterName?: string
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const signedIn = masterName !== undefined

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      {/* Шапка кабинета — две полки, а не одна строка из четырёх слов.
          В одну они не влезали: на 375 имя мастерской и «Моя карточка»
          ломались каждое на две строки, и шапка превращалась в четыре
          обрывка, стоящих по базовой линии кто где. Верхняя полка — кто
          и откуда вышел, нижняя — куда идти. */}
      <header>
      {/* Верхняя полка залита брендом — та же, что в публичной зоне
          (§ Components, 22.09): мебельщик и заказчица ходят по одному
          продукту, и полоса цвета у них общая. */}
      <div className="bg-brand">
        <div className="mx-auto flex w-full max-w-shelf flex-wrap items-center justify-between gap-x-lg gap-y-sm px-lg py-md">
          {/* Знак ведёт на главную проекта, как и в публичной зоне: из кабинета
              иначе нет выхода вовсе. */}
          <Link to="/" className={brandLink}>
            <BrandMark />
            {shell.brand}
          </Link>
          {/* Выход. Без него кабинет — ловушка: сессия живёт 12 часов,
              и войти другой мастерской нельзя вовсе. */}
          {signedIn && (
            <button
              type="button"
              className={signOutOnBrand}
              onClick={() => {
                // Отзыв на сервере, а не только очистка вкладки (§5в):
                // иначе токен остаётся действующим ключом до конца срока,
                // а кабинет открывают и с чужого телефона.
                const session = readSession()
                if (session !== null) void api.signOut(session.token).catch(() => undefined)
                clearSession()
                navigate('/master', { replace: true })
              }}
            >
              {masterShell.signOut}
            </button>
          )}
        </div>
      </div>

        {/* Нижняя полка: два места кабинета и имя мастерской справа.
            Имя — не украшение: у одного телефона бывает две мастерские,
            и Марат должен видеть, под какой он отвечает. */}
        {signedIn && (
          <div className="mx-auto mt-sm flex w-full max-w-shelf flex-wrap items-center justify-between gap-x-xl gap-y-xs border-b border-outline px-lg pb-xs">
            <nav className="flex items-center gap-xl">
              <AreaLink to="/master/requests" current={pathname.startsWith('/master/requests')}>
                {masterShell.requests}
              </AreaLink>
              {/* Своя карточка. До US-20 попасть в неё было нельзя вовсе:
                  маршрут существовал, ссылки на него не было ни на одном
                  экране, и мебельщик не видел, что о нём написано
                  в каталоге. */}
              <AreaLink to="/master/profile" current={pathname === '/master/profile'}>
                {masterShell.profile}
              </AreaLink>
            </nav>
            <p className={`min-w-0 truncate ${hintText}`}>{masterName}</p>
          </div>
        )}
      </header>

      {/* Страница — до 1440 (рама, шапка и подвал), содержимое — колонка 720
          (§ Layout). Пока это было одним числом, на широком экране плашки
          растягивались во всю раму, а текст внутри обрывался на своей мере
          и висел слева в пустоте. */}
      <main className="mx-auto w-full max-w-column flex-1 px-lg">{children}</main>

      <footer className="mx-auto w-full max-w-shelf px-lg">
        <p className="mt-3xl border-t border-outline pt-lg pb-xl text-body-sm tracking-body-sm text-on-surface-muted">
          {shell.band}
        </p>
      </footer>
    </div>
  )
}

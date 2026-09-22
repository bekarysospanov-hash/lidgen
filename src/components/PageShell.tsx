// Оболочка страницы: шапка, одна колонка до 1440px, подвал строкой
// (DESIGN.md § Layout, § Components). Вынесена из экрана заявки, чтобы
// страницы сквозного прохода не расходились вёрсткой.
//
// Шапка залита брендом (§ Components, правка 22.09): продукт узнаётся
// полосой цвета сверху, как узнаются площадки, которыми наш человек
// пользуется каждый день. Липкой она при этом не становится — прилипнув,
// отняла бы у телефона треть экрана.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { readSession } from '../session'
import { shell } from '../texts/shell'
import { BrandMark, MastersIcon, RequestIcon } from './icons'
import { link } from './ui'

/**
 * Словесный знак. Графит, а не синий: система требует у ссылки синеву
 * с подчёркиванием, но знак, набранный так, перестаёт читаться как знак.
 * Названное отступление, единственное в шапке — признак кликабельности
 * приходит наведением (DESIGN.md § Состояния, § Affordance).
 */
const brandLink =
  'flex min-h-target items-center gap-sm whitespace-nowrap text-subheading tracking-subheading ' +
  'font-medium text-on-brand underline-offset-4 hover:underline'

/**
 * Пункты навигации — переходы, то есть ссылки: синие, подчёркнуты всегда.
 * Иконка объясняет, куда ведёт пункт, раньше чем человек прочитает слово;
 * подпись остаётся — иконка без подписи допустима только у стрелки
 * и закрытия (DESIGN.md § Иконки).
 */
/**
 * Третий пункт шапки — со словом, а не иконкой. Ступень label, как у кнопки:
 * это вход, а не переход по разделу.
 */
/**
 * В залитой брендом шапке пункты белые, а не синие: синяя ссылка на
 * коричневом не читается вовсе. Правило «ссылка синяя с подчёркиванием»
 * работает на холсте; здесь его держит подчёркивание, а цвет задан полосой
 * (§ Components, «шапка бренда»).
 */
const navWord =
  'flex min-h-target items-center rounded-sm px-sm text-label tracking-label font-medium ' +
  'text-on-brand underline underline-offset-4 transition-[filter] duration-100 hover:brightness-92'

const navLink =
  'flex size-target items-center justify-center rounded-sm text-on-brand ' +
  'transition-[filter] duration-100 hover:brightness-92'

/**
 * Оболочка знает три раскладки (§ Layout, правка 20.09).
 *
 * `document` — колонка 720: форма, предложение, тексты. Всё, что читают
 * сверху вниз.
 *
 * `shelf` — витрина во всю раму: каталог. Сетка в колонке 720 превращается
 * в список из двух плиток в ряд, а справа остаётся полтора экрана пустоты.
 *
 * `item` — карточка предмета: та же колонка 720 плюс боковая колонка
 * действий справа. Отличается от `document` только тем, что рядом
 * с содержимым помещается панель; само содержимое остаётся колонкой.
 * Панель передаётся в `aside`, на телефоне уходит вниз экрана.
 */
export function PageShell({ children, layout = 'document', aside }: {
  children: React.ReactNode
  layout?: 'document' | 'shelf' | 'item'
  /** Панель действий карточки предмета. Только для layout="item". */
  aside?: React.ReactNode
}) {
  /**
   * Сессия читается один раз при монтировании: войти за время жизни
   * страницы можно только уйдя на /login, а он перерисует шапку сам.
   */
  const [session] = useState(() => readSession())
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      {/* Link, а не <a>: полная перезагрузка страницы обнулила бы заявку. */}
      {/* Знак слева, переходы прижаты вправо: посередине шапки им делать
          нечего, а у правого края они попадают под большой палец. */}
      <header className="bg-brand">
      <div className="mx-auto flex w-full max-w-shelf flex-wrap items-center justify-between gap-x-xl gap-y-sm px-lg py-md">
        {/* Знак ведёт на главную, а главная с 20.09 — каталог мастерских.
            «Заявка» по-прежнему ведёт на саму форму: со скелета до формы
            надо доходить руками (US-03). */}
        <Link to="/" className={brandLink}>
          <BrandMark />
          {shell.brand}
        </Link>
        {/* Подписи сняты, остались иконки: пунктов два, они постоянны и
            запоминаются за один визит (DESIGN.md § Иконки). Слово не
            исчезает совсем — оно уходит в aria-label и подсказку, иначе
            экранный диктор прочитает пустую ссылку. */}
        <nav className="-mr-sm flex items-center gap-xs">
          <Link to="/request" className={navLink}
            aria-label={shell.nav.request} title={shell.nav.request}>
            <RequestIcon />
          </Link>
          <Link to="/masters" className={navLink}
            aria-label={shell.nav.masters} title={shell.nav.masters}>
            <MastersIcon />
          </Link>
          {/* Третий пункт — вход или кабинет (правка 20.09). Подписан
              словом, а не иконкой: исключение § Иконок оговорено тремя
              пунктами, четвёртый в него не входит, и «человечек» —
              ровно та абстракция, которую человек угадывает, а не узнаёт.
              Каталог при этом остаётся открытым: войти предлагают,
              войти не требуют. */}
          <Link to={session === null ? '/login' : '/me'} className={`ml-sm ${navWord}`}>
            {session === null ? shell.nav.signIn : shell.nav.cabinet}
          </Link>
        </nav>
      </div>
      </header>

      {/* Страница — до 1440 (рама, шапка и подвал), содержимое — колонка 720
          (§ Layout). Пока это было одним числом, на широком экране плашки
          растягивались во всю раму, а текст внутри обрывался на своей мере
          и висел слева в пустоте. */}
      {layout === 'item' ? (
        /* Колонка содержимого и боковая колонка действий. На телефоне
           колонка одна, панель уходит вниз экрана (§ Layout). Рама здесь
           шире 720: в неё помещаются обе колонки и зазор между ними. */
        <main className="mx-auto w-full max-w-shelf flex-1 px-lg pt-xl">
          <div className="flex flex-col gap-2xl lg:flex-row lg:items-start lg:justify-center">
            <div className="w-full min-w-0 max-w-column">{children}</div>
            {aside !== undefined && (
              /* Единственное липкое в системе, и только на широком экране:
                 панель несёт то, ради чего человек открыл карточку. Шапка,
                 подвал и навигация липкими не становятся. */
              <div className="hidden w-full shrink-0 lg:block lg:w-aside lg:sticky lg:top-xl">
                {aside}
              </div>
            )}
          </div>
        </main>
      ) : (
        <main className={`mx-auto w-full flex-1 px-lg pt-xl ${layout === 'shelf' ? 'max-w-shelf' : 'max-w-column'}`}>
          {children}
        </main>
      )}

      {/* Подвал: разделитель там, где расстояния в конце длинной страницы
          не хватает, и одна приглушённая строка. Плашки нет — она несёт смысл
          «это одно целое», а одна строка и так целое (DESIGN.md § Elevation). */}
      <footer className="mx-auto w-full max-w-shelf px-lg">
        <div className="mt-3xl flex flex-wrap items-baseline gap-x-lg gap-y-sm border-t border-outline pt-lg pb-xl">
          <p className="text-body-sm tracking-body-sm text-on-surface-muted">{shell.band}</p>
          {/* Рассказ о сервисе: главная — каталог, и открыть его больше
              неоткуда (правка 20.09). */}
          {/* min-h-target: ссылка подвала стоит сама по себе, а не внутри
              абзаца, и исключение § Размера цели на неё не распространяется
              — 23 пикселя высоты мимо правила о 44. */}
          <span className="ml-auto flex flex-wrap items-center gap-x-lg">
            <Link to="/promo"
              className={`inline-flex min-h-target items-center text-body-sm tracking-body-sm ${link}`}>
              {shell.howItWorks}
            </Link>
            {/* Вход мебельщика стоит в подвале, а не в шапке: шапка
                принадлежит заказчице, и выбирать «кто вы» ей не из чего.
                Дверь одна — ссылка ведёт на тот же /login, роль решает
                сервер по номеру (контракт §5в). */}
            <Link to="/login"
              className={`inline-flex min-h-target items-center text-body-sm tracking-body-sm ${link}`}>
              {shell.masterEntry}
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}

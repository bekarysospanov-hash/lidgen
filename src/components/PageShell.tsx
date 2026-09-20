// Оболочка страницы: шапка, одна колонка до 1440px, подвал строкой
// (DESIGN.md § Layout, § Components). Вынесена из экрана заявки, чтобы
// страницы сквозного прохода не расходились вёрсткой.
//
// Липкой шапки нет и цвет здесь площади не занимает: в системе
// «Мастерская — присутствие» высота передаётся тоном поверхности, а оболочка
// остаётся холстом — выделяться должно содержимое, а не рама вокруг него.
import { Link } from 'react-router-dom'
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
  'font-medium text-on-surface underline-offset-4 hover:underline'

/**
 * Пункты навигации — переходы, то есть ссылки: синие, подчёркнуты всегда.
 * Иконка объясняет, куда ведёт пункт, раньше чем человек прочитает слово;
 * подпись остаётся — иконка без подписи допустима только у стрелки
 * и закрытия (DESIGN.md § Иконки).
 */
const navLink =
  'flex size-target items-center justify-center rounded-sm text-link ' +
  'transition-colors duration-100 hover:bg-surface-container'

/**
 * Оболочка знает две раскладки (§ Layout, правка 20.09).
 *
 * `document` — колонка 720: форма, предложение, карточка, тексты. Всё,
 * что читают сверху вниз.
 *
 * `shelf` — витрина во всю раму: каталог. Сетка в колонке 720 превращается
 * в список из двух плиток в ряд, а справа остаётся полтора экрана пустоты.
 */
export function PageShell({ children, layout = 'document' }: {
  children: React.ReactNode
  layout?: 'document' | 'shelf'
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      {/* Link, а не <a>: полная перезагрузка страницы обнулила бы заявку. */}
      {/* Знак слева, переходы прижаты вправо: посередине шапки им делать
          нечего, а у правого края они попадают под большой палец. */}
      <header className="mx-auto flex w-full max-w-shelf flex-wrap items-baseline justify-between gap-x-xl gap-y-sm px-lg pt-lg pb-xl">
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
        </nav>
      </header>

      {/* Страница — до 1440 (рама, шапка и подвал), содержимое — колонка 720
          (§ Layout). Пока это было одним числом, на широком экране плашки
          растягивались во всю раму, а текст внутри обрывался на своей мере
          и висел слева в пустоте. */}
      <main className={`mx-auto w-full flex-1 px-lg ${layout === 'shelf' ? 'max-w-shelf' : 'max-w-column'}`}>
        {children}
      </main>

      {/* Подвал: разделитель там, где расстояния в конце длинной страницы
          не хватает, и одна приглушённая строка. Плашки нет — она несёт смысл
          «это одно целое», а одна строка и так целое (DESIGN.md § Elevation). */}
      <footer className="mx-auto w-full max-w-shelf px-lg">
        <div className="mt-3xl flex flex-wrap items-baseline gap-x-lg gap-y-sm border-t border-outline pt-lg pb-xl">
          <p className="text-body-sm tracking-body-sm text-on-surface-muted">{shell.band}</p>
          {/* Рассказ о сервисе: главная — каталог, и открыть его больше
              неоткуда (правка 20.09). */}
          <Link to="/promo" className={`ml-auto text-body-sm tracking-body-sm ${link}`}>
            {shell.howItWorks}
          </Link>
        </div>
      </footer>
    </div>
  )
}

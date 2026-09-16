// Оболочка страницы: навигация сверху, одна колонка до 1440px, терминальная
// полоса снизу (DESIGN.md § Layout, § Состояния). Вынесена из экрана заявки,
// чтобы страницы сквозного прохода не расходились вёрсткой и чтобы
// единственное исключение из правил цвета — лаймовая полоса — жило в одном
// месте, а не копировалось по файлам.
import { Link } from 'react-router-dom'
import { shell } from '../texts/shell'

/** Навигация: капс, через запятую, без фона и рамки, прямо на белом. */
const navLink =
  'whitespace-nowrap underline-offset-4 transition-opacity duration-100 ' +
  'hover:underline active:opacity-70'

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      {/* Link, а не <a>: полная перезагрузка страницы обнулила бы заявку. */}
      <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-baseline gap-x-xl gap-y-sm px-lg pt-lg pb-xl text-caps tracking-caps uppercase">
        {/* Словесный знак ведёт на лендинг; «Заявка» — на саму форму, а не
            на главную: со скелета до формы надо доходить руками (US-03). */}
        <Link to="/" className={`lowercase ${navLink}`}>{shell.brand}</Link>
        <nav className="flex flex-wrap gap-x-xl gap-y-sm">
          <Link to="/request" className={navLink}>{shell.nav.request}</Link>
          <Link to="/masters" className={navLink}>{shell.nav.masters}</Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-lg">{children}</main>

      {/* Терминальная полоса — единственное место, где цвет занимает площадь */}
      {/* design-ok: bg-terminal — это и есть та самая полоса, DESIGN.md § Colors */}
      <div className="mt-2xl flex items-center bg-terminal px-lg py-md text-caps tracking-caps text-on-terminal uppercase">
        {shell.band}
      </div>
    </div>
  )
}

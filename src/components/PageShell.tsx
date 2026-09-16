// Оболочка страницы: шапка, одна колонка до 1440px, подвал строкой
// (DESIGN.md § Layout, § Components). Вынесена из экрана заявки, чтобы
// страницы сквозного прохода не расходились вёрсткой.
//
// Липкой шапки нет и цвет здесь площади не занимает: в системе
// «Мастерская — присутствие» высота передаётся тоном поверхности, а оболочка
// остаётся холстом — выделяться должно содержимое, а не рама вокруг него.
import { Link } from 'react-router-dom'
import { shell } from '../texts/shell'

/**
 * Словесный знак. Графит, а не синий: система требует у ссылки синеву
 * с подчёркиванием, но знак, набранный так, перестаёт читаться как знак.
 * Названное отступление, единственное в шапке — признак кликабельности
 * приходит наведением (DESIGN.md § Состояния, § Affordance).
 */
const brandLink =
  'whitespace-nowrap text-subheading tracking-subheading font-medium ' +
  'text-on-surface underline-offset-4 hover:underline'

/** Пункты навигации — переходы, то есть ссылки: синие, подчёркнуты всегда. */
const navLink =
  'whitespace-nowrap text-body tracking-body text-link underline underline-offset-4'

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      {/* Link, а не <a>: полная перезагрузка страницы обнулила бы заявку. */}
      <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-baseline gap-x-xl gap-y-sm px-lg pt-lg pb-xl">
        {/* Словесный знак ведёт на лендинг; «Заявка» — на саму форму, а не
            на главную: со скелета до формы надо доходить руками (US-03). */}
        <Link to="/" className={brandLink}>{shell.brand}</Link>
        <nav className="flex flex-wrap gap-x-lg gap-y-sm">
          <Link to="/request" className={navLink}>{shell.nav.request}</Link>
          <Link to="/masters" className={navLink}>{shell.nav.masters}</Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-lg">{children}</main>

      {/* Подвал: разделитель там, где расстояния в конце длинной страницы
          не хватает, и одна приглушённая строка. Плашки нет — она несёт смысл
          «это одно целое», а одна строка и так целое (DESIGN.md § Elevation). */}
      <footer className="mx-auto w-full max-w-[1440px] px-lg">
        <p className="mt-3xl border-t border-outline pt-lg pb-xl text-body-sm tracking-body-sm text-on-surface-muted">
          {shell.band}
        </p>
      </footer>
    </div>
  )
}

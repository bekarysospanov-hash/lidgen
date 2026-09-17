// Оболочка кабинета мебельщика. Отдельно от PageShell, потому что зоны
// разные: у заказчицы в шапке «Заявка» и «Мастерские» — переходы, которые
// Марату не нужны и сбивают, а у него в шапке стоит то, чего нет у неё, —
// имя его мастерской. Общее — знак, колонка до 1440 и отсутствие липкости
// (DESIGN.md § Layout).
import { Link } from 'react-router-dom'
import { shell } from '../texts/shell'
import { masterShell } from '../texts/master'
import { BrandMark } from './icons'
import { hintText } from './ui'

const brandLink =
  'flex items-center gap-sm whitespace-nowrap text-subheading tracking-subheading ' +
  'font-medium text-on-surface underline-offset-4 hover:underline'

export function MasterShell({
  masterName,
  children,
}: {
  /** Кто вошёл. Настоящее имя мастерской, а не «личный кабинет» вообще. */
  masterName?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-baseline justify-between gap-x-xl gap-y-sm px-lg pt-lg pb-xl">
        {/* Знак ведёт на главную проекта, как и в публичной зоне: из кабинета
            иначе нет выхода вовсе. К своим заявкам возвращает ссылка
            «Все заявки» на карточке и адрес /master/requests. */}
        <Link to="/" className={brandLink}>
          <BrandMark />
          {shell.brand}
        </Link>
        {/* Имя мастерской — не украшение: у одного телефона бывает две
            мастерские, и Марат должен видеть, под какой он отвечает. */}
        <p className={hintText}>{masterName ?? masterShell.area}</p>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-lg">{children}</main>

      <footer className="mx-auto w-full max-w-[1440px] px-lg">
        <p className="mt-3xl border-t border-outline pt-lg pb-xl text-body-sm tracking-body-sm text-on-surface-muted">
          {shell.band}
        </p>
      </footer>
    </div>
  )
}

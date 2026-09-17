// Знак проекта и иконки навигации. Рисуются вручную в стиле § Иконки:
// контур, скруглённые концы, одна перспектива. Генерации изображений
// в проекте нет, сборные наборы не берём — они разъезжаются по толщине.

/**
 * Знак «Капибара». Капибара опознаётся по силуэту: тупая прямоугольная
 * морда, маленькие круглые уши на макушке, тяжёлый лоб. Рисуется анфас
 * и одной линией контура — на 28 пикселях любая шерсть и лапы превратятся
 * в грязь.
 *
 * Почему вообще зверь: сервис сводит незнакомых людей — заказчицу и
 * мебельщика, — и знак должен читаться как спокойный и не пугающий.
 * Капибара для этого подходит буквально: её узнают именно по невозмутимости.
 */
export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-icon-lg shrink-0">
      {/* Шерсть — единственное место системы, где живёт коричневый
          (DESIGN.md § Colors, brand-fur). Уши круглые и маленькие, посажены
          высоко и близко: у капибары они именно такие, и по ним её отличают
          от медведя, у которого уши крупные и разнесены по краям. */}
      <g fill="var(--color-brand-fur)">
        {/* Уши мелкие и сидят на самой макушке. У медведя они крупные и
            разнесены по краям головы — этим силуэты и различаются. */}
        <circle cx="11.2" cy="6.2" r="1.9" />
        <circle cx="20.8" cy="6.2" r="1.9" />
        {/* Голова: широкий плоский лоб сверху, вытянутая книзу прямоугольная
            морда. Высота заметно больше ширины — это и есть капибара,
            круглая голова читалась бы как медведь. */}
        <path d="M6 12c0-3.6 4.5-6 10-6s10 2.4 10 6v5.5c0 2.6-1 4.6-2.6 6
                 C21.6 25 19 26.5 16 26.5s-5.6-1.5-7.4-3C7 22.1 6 20.1 6 17.5z" />
      </g>
      {/* Тень на шерсти — тот же коричневый прозрачностью, второго
          коричневого в системе нет (DESIGN.md § Colors). */}
      <path d="M10.4 21c1.6 1.3 3.5 2 5.6 2s4-.7 5.6-2v1.8
               c-1.6 1.3-3.5 2-5.6 2s-4-.7-5.6-2z"
        fill="var(--color-brand-fur)" opacity="0.45" />
      {/* Черты морды — графитом. Глаза посажены высоко и широко, ноздри
          у самого низа: у капибары глаза и ноздри сдвинуты к макушке,
          чтобы торчали над водой. Морда спокойная, без улыбки: знак
          сервиса, а не наклейка. */}
      <g fill="var(--color-on-surface)">
        <circle cx="11.6" cy="13.2" r="1.25" />
        <circle cx="20.4" cy="13.2" r="1.25" />
        <circle cx="14.4" cy="21.2" r="0.85" />
        <circle cx="17.6" cy="21.2" r="0.85" />
      </g>
      <path d="M16 22.2v1.4" stroke="var(--color-on-surface)" strokeWidth="1.2"
        strokeLinecap="round" fill="none" />
    </svg>
  )
}

/**
 * «Заявка» — лист с заполненными строками: именно это и происходит по нажатию,
 * человек попадает на форму. Не карандаш и не плюс: плюс обещает создание
 * чего-то нового каждый раз, а заявка одна.
 */
export function RequestIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-icon-sm shrink-0"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18H6z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h3" />
    </svg>
  )
}

/**
 * «Мастерские» — навес витрины над прилавком: нажатие ведёт в каталог
 * мастерских, то есть в место, где смотрят на тех, кто работает. Инструмент
 * (молоток, пила) был бы про ремесло, а не про выбор исполнителя.
 */
export function MastersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-icon-sm shrink-0"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l1.5-3h15L21 7" />
      <path d="M3 7h18" />
      <path d="M4.5 7v13h15V7" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

/**
 * Крестик — снять снимок из списка. Одна из двух иконок, которым система
 * разрешает жить без подписи: закрытие узнают по форме (§ Иконки).
 * Подпись всё равно существует в aria-label — для экранного диктора.
 */
export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-icon-sm shrink-0"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  )
}

/**
 * Галочка для строк-обещаний в шапке экрана. Зелёная: в системе зелёный —
 * действие, успех и выбор (§ Colors), и «так будет» относится к успеху.
 */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-icon-sm shrink-0 text-primary"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  )
}

/**
 * Шеврон — строка ведёт дальше (DESIGN.md § Components, «Строка блока»).
 * Вторая иконка, которой система разрешает жить без подписи: стрелку узнают
 * по форме, а сама строка подписана названием заявки. Направление вправо,
 * а не вниз: строка открывает новый экран, а не раскрывается на месте.
 */
export function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-icon-sm shrink-0"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

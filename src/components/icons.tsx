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
export function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-md" fill="none"
      stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  )
}

/**
 * Камера — добавить снимок комнаты. Подпись у кнопки остаётся: система
 * разрешает иконку действия там, где действие узнают по форме, но снимать
 * подпись запрещает везде, кроме навигации шапки (§ Иконки).
 *
 * Круглый объектив — предметный контур, а не форма элемента интерфейса:
 * запрет на круглое сверх точки и чипса про поверхности и отметки, а камера
 * без круга в середине перестаёт быть камерой.
 */
export function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-icon-sm shrink-0"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5a2 2 0 0 1 2-2h1.8l1.3-2h5.8l1.3 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13.5" r="3.2" />
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

/**
 * Знаки услуг мастерской (§ Иконки: «смысловые в блоках — только если блок
 * без иконки читается хуже»). Список услуг закрыт схемой ровно потому, что
 * под каждое значение нужен знак: произвольную строку рисовать нечем.
 *
 * Подписи не снимаются ни у одной: узнаваемого прототипа здесь нет ни у чего,
 * кроме грузовика, а угаданная иконка — это украшение, изображающее работу.
 * Все рисуются одним каркасом: 24, толщина 1.5, скруглённые концы — иначе
 * восемь знаков, нарисованных по отдельности, расходятся в стиле.
 */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-icon shrink-0"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

/** Замер — рулетка: корпус с лентой и делениями. */
export function MeasureIcon() {
  return (
    <Glyph>
      <path d="M3 9h18v6H3z" />
      <path d="M7.5 9v2.5M12 9v3.5M16.5 9v2.5" />
    </Glyph>
  )
}

/** Проект — лист с чертежом: рамка и линии плана внутри. */
export function DesignIcon() {
  return (
    <Glyph>
      <path d="M4 4h16v16H4z" />
      <path d="M4 10h9M13 10v10" />
    </Glyph>
  )
}

/** Доставка — фургон. Единственный знак здесь с готовым прототипом. */
export function DeliveryIcon() {
  return (
    <Glyph>
      <path d="M2 7h11v9H2z" />
      <path d="M13 10h4l3 3.2V16h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </Glyph>
  )
}

/** Сборка и установка — отвёртка: жало, хват, рукоять. */
export function AssemblyIcon() {
  return (
    <Glyph>
      <path d="M3.5 20.5l6.2-6.2" />
      <path d="M9.2 13.6l3.4 3.4 2.1-2.1-3.4-3.4z" />
      <path d="M13.5 10.2l3.1-3.1a2.6 2.6 0 0 1 3.7 3.7l-3.1 3.1" />
    </Glyph>
  )
}

/** Уберёт старую мебель — вынесенный короб со стрелкой наружу. */
export function DismantleIcon() {
  return (
    <Glyph>
      <path d="M4 10h9v10H4z" />
      <path d="M4 10l2-4h5l2 4" />
      <path d="M16 8h5m0 0-2.2-2.2M21 8l-2.2 2.2" />
    </Glyph>
  )
}

/** Встроит технику — духовка: дверца с окном и ручкой. */
export function AppliancesIcon() {
  return (
    <Glyph>
      <path d="M4 4h16v16H4z" />
      <path d="M4 8h16" />
      <path d="M7 12h10v5H7z" />
    </Glyph>
  )
}

/** Оплата частями — та же сумма, разнесённая на два платежа. */
export function InstallmentsIcon() {
  return (
    <Glyph>
      <path d="M3 6h13v8H3z" />
      <path d="M8 18h13" />
      <path d="M18 15l3 3-3 3" />
    </Glyph>
  )
}

/** Нестандарт — скошенная стена и размер поперёк неё. */
export function NonstandardIcon() {
  return (
    <Glyph>
      <path d="M4 20V9l7-5v16z" />
      <path d="M15 7v12m0-12-1.8 1.8M15 7l1.8 1.8m-1.8 10.2-1.8-1.8M15 19l1.8-1.8" />
    </Glyph>
  )
}

/** Гарантия — щит: обещание, за которым мастерская стоит. */
export function WarrantyIcon() {
  return (
    <Glyph>
      <path d="M12 3l7 2.6v5.6c0 4-2.9 7.4-7 8.8-4.1-1.4-7-4.8-7-8.8V5.6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </Glyph>
  )
}

/** Срок изготовления — часы. Прототип готовый, но подпись всё равно стоит. */
export function LeadTimeIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Glyph>
  )
}

/** Часы работы — календарная неделя: когда мастерская на месте. */
export function HoursIcon() {
  return (
    <Glyph>
      <path d="M4 6h16v14H4z" />
      <path d="M4 10h16M9 4v4M15 4v4" />
    </Glyph>
  )
}

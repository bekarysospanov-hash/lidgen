// Компоненты DESIGN.md § Components — по одной строке классов на каждый.
//
// Зачем отдельным файлом. До этого каждый экран толковал систему сам: своя
// копия кнопки в OtpConfirm, своя в RequestSent, свой вариант поля в
// PhoneInput. Одно расхождение с файлом размножалось на шесть мест, и правка
// системы превращалась в шесть правок, три из которых забывались.
//
// Здесь не заводится ничего сверх DESIGN.md: это ровно input · option-card ·
// button-filled · button-text · panel · badge из раздела Components.

/**
 * input — белый фон, граница 1px `outline`, радиус 4. Единственное место
 * системы, где у элемента есть обводка: она обозначает, куда можно писать.
 * Состояния меняют цвет границы, но не её толщину (§ Components).
 */
export const field = (invalid = false) =>
  'bg-surface rounded-sm border px-md py-sm text-body tracking-body ' +
  'placeholder:text-on-surface-muted transition-colors duration-100 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  (invalid ? 'border-error' : 'border-outline hover:border-on-surface-muted')

/**
 * option-card — плашка первого уровня, радиус 8, отступ 16. Выбранная
 * поднимается на второй уровень; заливки всей карточки цветом нет, она бы
 * конкурировала с кнопкой (§ Components).
 *
 * Фокус берёт primary со смещением 2px (§ Состояния): контур снимается
 * с самой карточки, потому что настоящий radio/checkbox внутри — sr-only.
 */
export const optionCard = (selected: boolean) =>
  'group flex cursor-pointer items-start gap-md rounded-md p-lg text-left ' +
  'text-body tracking-body transition-[background-color,filter] duration-100 ' +
  // Наведение 8%, нажатие 12% — те же числа, что у кнопки (§ Состояния).
  // Нажатие обязательно отдельно от наведения: на телефоне hover не
  // существует вовсе, и без active карточка не отвечает на касание ничем.
  'hover:brightness-92 active:brightness-88 ' +
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ' +
  'has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2 ' +
  'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40 ' +
  'has-[:disabled]:hover:brightness-100 ' +
  (selected ? 'bg-surface-container-high' : 'bg-surface-container')

/**
 * Метка выбранного варианта — сливовый квадрат (§ Состояния: «второй уровень
 * поверхности плюс сливовая метка»). Невыбранная — контур, а не заливка:
 * пустой квадрат читается как «здесь можно отметить».
 */
export const optionMark = (selected: boolean) =>
  'mt-[0.15em] size-4 shrink-0 rounded-sm transition-colors duration-100 ' +
  (selected ? 'bg-accent' : 'border border-outline')

/**
 * button-filled — зелёная заливка, белая надпись, радиус 4. Одна главная
 * кнопка на экран. Наведение и нажатие затемняют заливку на 8 и 12 процентов
 * (§ Состояния), поэтому brightness, а не прозрачность: снижение
 * непрозрачности на светлом холсте осветляет, а не затемняет.
 */
export const buttonFilled =
  'inline-flex items-center justify-center rounded-sm bg-primary px-xl py-md ' +
  'text-label tracking-label font-medium text-on-primary ' +
  'transition-[filter,opacity] duration-100 hover:brightness-92 active:brightness-88 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100'

/** button-text — зелёная надпись без заливки, второстепенное действие рядом с главным. */
export const buttonText =
  'inline-flex items-center justify-center rounded-sm px-sm py-sm ' +
  'text-label tracking-label font-medium text-primary underline-offset-4 ' +
  'transition-opacity duration-100 hover:underline ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline'

/** panel — первый уровень, радиус 8, внутренний отступ 24. */
export const panel = 'rounded-md bg-surface-container p-xl'

/** panel-nested — второй уровень, радиус 4, отступ 12. Глубже не вкладывать. */
export const panelNested = 'rounded-sm bg-surface-container-high p-md'

/** badge — сливовая заливка, белая надпись, радиус 4. Короткое слово, не предложение. */
export const badge =
  'inline-block rounded-sm bg-accent px-sm py-xs text-label tracking-label ' +
  'font-medium text-on-accent'

/** link — синяя, с подчёркиванием. Подчёркивание не убирать (§ Components). */
export const link = 'text-link underline underline-offset-4'

/** error-text — сообщение об ошибке: красным, на 15px, под полем (§ Состояния). */
export const errorTextClass = 'text-body-sm tracking-body-sm text-error'

/** hint-text — второстепенный текст: подсказки, подписи, счётчики. */
export const hintText = 'text-body-sm tracking-body-sm text-on-surface-muted'

/**
 * Метка поля — ступень label, 14/500 (§ Typography: «кнопки, метки, шильдики»).
 * Не hint-text: подсказка и имя поля — разные роли, и набранное подсказкой
 * имя поля читается как пояснение, которое можно пропустить.
 */
export const fieldLabel = 'text-label tracking-label font-medium text-on-surface'

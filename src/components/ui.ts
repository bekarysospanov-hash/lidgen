// Компоненты DESIGN.md § Components — по одной строке классов на каждый.
//
// Зачем отдельным файлом. До этого каждый экран толковал систему сам: своя
// копия кнопки в OtpConfirm, своя в RequestSent, свой вариант поля в
// PhoneInput. Одно расхождение с файлом размножалось на шесть мест, и правка
// системы превращалась в шесть правок, три из которых забывались.
//
// Здесь не заводится ничего сверх DESIGN.md: это ровно input · block-row ·
// chip · choice-dot · button-filled · button-text · panel · panel-nested ·
// link из раздела Components.
//
// И ничего сверх ПРИМЕНЁННОГО: `badge` описан в системе, но ни на одном
// экране пока не стоит, поэтому строки под него здесь нет. Заводить впрок
// нельзя — неприменённая строка классов не проверяется ничем и тихо
// расходится с файлом. Появится шильдик на карточке мебельщика — появится
// и строка.

/**
 * input — белый фон, граница 1px `outline`, радиус 4. Одно из двух мест
 * системы, где обводка законна: она обозначает, куда можно писать.
 * Состояния меняют цвет границы, но не её толщину (§ Components).
 */
export const field = (invalid = false) =>
  'bg-surface rounded-sm border px-md py-sm text-body tracking-body ' +
  'placeholder:text-on-surface-muted transition-colors duration-100 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  (invalid ? 'border-error' : 'border-outline hover:border-on-surface-muted')

/** panel — первый уровень, радиус 8, внутренний отступ 24. */
export const panel = 'rounded-md bg-surface-container p-xl'

/**
 * Контейнер шага — плашка первого уровня, в которой лежат ТОЛЬКО элементы
 * выбора. Счётчик, вопрос и подсказка стоят снаружи, над плашкой, и
 * называют её: так заголовок принадлежит разделу, а не карточке, и список
 * читается как список под заголовком, а не как карточка с шапкой.
 */
export const stepPanel = 'rounded-md bg-surface-container p-lg'

/**
 * block-row — основной строительный элемент формы: иконка слева, название,
 * подсказка снизу, справа точка выбора (§ Components).
 *
 * Собственного фона у невыбранной строки нет — она лежит на плашке блока.
 * Выбранная поднимается на второй уровень, получает радиус 4 и зелёную
 * обводку. Обводка прозрачная у невыбранной, а не отсутствующая: иначе
 * появление рамки сдвигало бы строку на пиксель.
 */
export const blockRow = (selected: boolean) =>
  'group flex w-full cursor-pointer items-center gap-md rounded-sm border ' +
  'px-md py-md text-left text-body tracking-body ' +
  'transition-[background-color,border-color,filter] duration-100 ' +
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ' +
  'has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2 ' +
  (selected
    ? 'border-primary bg-surface-container-high'
    : 'border-transparent hover:brightness-97 active:brightness-94')

/** Обёртка строки: несёт разделитель, чтобы он не спорил с обводкой выбранной. */
export const blockRowDivider = 'border-b border-outline last:border-b-0'

/**
 * choice-dot — круг 20 с границей `outline`; отмеченный заливается зелёным
 * (§ Components). Круглое в системе разрешено ровно двум вещам, и это одна
 * из них: квадратный индикатор глаз проскакивает мимо.
 */
export const choiceDot = (selected: boolean) =>
  'ml-auto size-5 shrink-0 rounded-full border-2 transition-colors duration-100 ' +
  (selected ? 'border-primary bg-primary' : 'border-outline')

/**
 * chip — короткое значение пилюлей: город, «да / нет», «пока не знаю».
 * Внутри блока невыбранный чипс берёт второй уровень, а не первый: блок сам
 * первого уровня, и чипс на нём иначе сливается с фоном.
 */
export const chip = (selected: boolean) =>
  'inline-flex cursor-pointer items-center rounded-full border px-lg py-sm ' +
  'text-label tracking-label font-medium transition-colors duration-100 ' +
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ' +
  'has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2 ' +
  (selected
    ? 'border-primary bg-primary text-on-primary'
    : 'border-outline bg-surface-container-high text-on-surface hover:brightness-97')

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

/** panel-nested — второй уровень, радиус 4, отступ 12. Глубже не вкладывать. */
export const panelNested = 'rounded-sm bg-surface-container-high p-md'

/**
 * badge — шильдик: сливовая заливка, белая надпись, радиус 4, короткое слово
 * (§ Components). Появился здесь, когда появилось применение: отметка
 * «отвечено» в списке заявок кабинета. Слива — место акцента и никогда
 * не выбор и не действие, а отметка о прошедшем событии — ровно акцент.
 */
export const badge =
  'inline-flex items-center rounded-sm bg-accent px-sm py-xs ' +
  'text-label tracking-label font-medium text-on-accent'

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

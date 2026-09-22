// Компоненты DESIGN.md § Components — по одной строке классов на каждый.
//
// Зачем отдельным файлом. До этого каждый экран толковал систему сам: своя
// копия кнопки в OtpConfirm, своя в RequestSent, свой вариант поля в
// PhoneInput. Одно расхождение с файлом размножалось на шесть мест, и правка
// системы превращалась в шесть правок, три из которых забывались.
//
// Здесь не заводится ничего сверх DESIGN.md: это ровно input · block-row ·
// chip · choice-dot · choice-box · button-filled · button-text · panel ·
// panel-nested · link из раздела Components.
//
// И ничего сверх ПРИМЕНЁННОГО: заводить строку классов впрок нельзя —
// неприменённая, она не проверяется ничем и тихо расходится с файлом.

/**
 * input — белый фон, граница 1px `outline`, радиус 10. Одно из двух мест
 * системы, где обводка законна: она обозначает, куда можно писать.
 * Состояния меняют цвет границы, но не её толщину (§ Components).
 */
export const field = (invalid = false) =>
  'bg-surface min-h-target rounded-sm border px-md py-sm text-body tracking-body ' +
  'placeholder:text-on-surface-muted transition-colors duration-100 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 ' +
  (invalid ? 'border-error' : 'border-outline hover:border-on-surface-muted')

/** panel — первый уровень, радиус 16, внутренний отступ 24. */
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
 * Выбранная поднимается на второй уровень, получает радиус 10 и зелёную
 * обводку. Обводка прозрачная у невыбранной, а не отсутствующая: иначе
 * появление рамки сдвигало бы строку на пиксель.
 */
export const blockRow = (selected: boolean, run: Run = {}) => {
  const base =
    'group flex w-full cursor-pointer items-center gap-md border ' +
    'px-md py-md text-left text-body tracking-body ' +
    'transition-[background-color,border-color,filter] duration-100 ' +
    'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ' +
    'has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2 '
  if (!selected) {
    return `${base}rounded-sm border-transparent hover:brightness-97 active:brightness-94`
  }
  // Внутренняя граница группы перекрашивается в её же фон, а не снимается:
  // снятая уносит пиксель высоты, и строка прыгает при отметке (§ Components).
  const top = run.afterSelected === true
  const bottom = run.beforeSelected === true
  return [
    base,
    'bg-surface-container-high border-primary',
    top ? 'rounded-t-none border-t-surface-container-high' : 'rounded-t-sm',
    bottom ? 'rounded-b-none border-b-surface-container-high' : 'rounded-b-sm',
  ].join(' ')
}

/**
 * Где строка стоит в цепочке выбранных. Пустой объект — строка сама по себе
 * (так её и вызывают там, где соседей нет: одиночная отметка снимка).
 */
export type Run = { afterSelected?: boolean; beforeSelected?: boolean }

/**
 * Обёртка строки: несёт разделитель, чтобы он не спорил с обводкой выбранной.
 * Внутри группы выбранных разделитель гасится — серая линия поперёк зелёной
 * рамки читается как ошибка вёрстки (§ Components, правка 20.09).
 */
export const blockRowDivider = (insideRun = false) =>
  insideRun ? 'border-b border-transparent' : 'border-b border-outline last:border-b-0'

/**
 * choice-dot — круг 20 с границей `outline`; отмеченный заливается зелёным
 * (§ Components). Означает «одно из»: отметив второе, человек снимает первое.
 * Круглое в системе разрешено двум вещам — точке и чипсу, — и здесь круг
 * не просто разрешён, а обязателен: квадрат в единичном выборе глаз
 * проскакивает мимо. Множественный выбор носит квадрат, см. `choiceBox`.
 */
export const choiceDot = (selected: boolean) =>
  'ml-auto size-icon-sm shrink-0 rounded-full border-2 transition-colors duration-100 ' +
  (selected ? 'border-primary bg-primary' : 'border-outline')

/**
 * choice-box — квадрат 20 с радиусом 4 и границей `outline`; отмеченный
 * заливается зелёным, внутри белая галочка (§ Components).
 *
 * Единственная квадратная отметка системы, и форма здесь несёт смысл: круг
 * точки означает «одно из», квадрат — «отметь сколько нужно». Квадрат
 * в единичном выборе система запрещает по-прежнему — там он не добавляет
 * к кругу ничего и глаз проскакивает его мимо (§ Shapes).
 *
 * Галочка обязательна: заливка без неё отличается от невыбранного состояния
 * только цветом, а § Состояния требует трёх каналов сразу — тон, контур,
 * отметка.
 */
export const choiceBox = (selected: boolean) =>
  'ml-auto flex size-icon-sm shrink-0 items-center justify-center rounded-sm border-2 ' +
  'transition-colors duration-100 ' +
  (selected ? 'border-primary bg-primary text-on-primary' : 'border-outline')

/**
 * chip — короткое значение пилюлей: город, «да / нет», «пока не знаю».
 * Внутри блока невыбранный чипс берёт второй уровень, а не первый: блок сам
 * первого уровня, и чипс на нём иначе сливается с фоном.
 *
 * Границы применимости — два условия сразу (§ Components): значений в группе
 * не больше пяти и самое длинное не длиннее 22 знаков. Не проходит хотя бы
 * по одному — это строки с `choiceBox`, а не чипсы.
 */
export const chip = (selected: boolean) =>
  'inline-flex min-h-target cursor-pointer items-center rounded-full border px-lg py-sm ' +
  'text-label tracking-label font-medium transition-colors duration-100 ' +
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ' +
  'has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2 ' +
  (selected
    ? 'border-primary bg-primary text-on-primary'
    : 'border-outline bg-surface-container-high text-on-surface hover:brightness-97')

/**
 * button-filled — заливка графитом, надпись цветом холста, радиус 10
 * (§ Components, правка 22.09: зелёной кнопка была до того, как бренд занял
 * площадь). Одна главная кнопка на экран. Наведение и нажатие затемняют
 * заливку на 8 и 12 процентов (§ Состояния), поэтому brightness, а не
 * прозрачность: снижение
 * непрозрачности на светлом холсте осветляет, а не затемняет.
 */
export const buttonFilled =
  'inline-flex min-h-target items-center justify-center rounded-sm bg-on-surface px-xl py-md ' +
  'text-label tracking-label font-medium text-surface ' +
  'transition-[filter,opacity] duration-100 hover:brightness-92 active:brightness-88 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100'

/**
 * button-text — надпись графитом без заливки, второстепенное действие рядом
 * с главным. `gap-sm` — расстояние до иконки действия, когда она есть
 * («Добавить фото»); у кнопки с одной подписью он ничего не двигает.
 */
export const buttonText =
  'inline-flex min-h-target items-center justify-center gap-sm rounded-sm px-sm py-sm ' +
  'text-label tracking-label font-medium text-on-surface underline-offset-4 ' +
  'transition-opacity duration-100 hover:underline ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline'

/**
 * tile — плитка витрины: карточка мастерской в сетке каталога (§ Components,
 * заведена 20.09, пересобрана 22.09). Снимок скруглён по md, подложки
 * и тени нет, расстояние до подписей живёт
 * на содержимом, а не на самой плитке: фото-крышка идёт во всю ширину
 * и отступа иметь не должна.
 *
 * Тени и подложки у плитки нет (§ Elevation, правка 22.09): снимок держит
 * себя сам, а серый прямоугольник вокруг делал из витрины сетку одинаковых
 * карточек. Наведение — лёгкое затемнение, как у всех нажимаемых
 * поверхностей.
 */
export const tile =
  'group flex h-full flex-col ' +
  'transition-[filter] duration-100 hover:brightness-97 active:brightness-94 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ' +
  'focus-visible:outline-offset-2'

/** tile-photo — снимок плитки: скруглён по md, фон на время загрузки. */
export const tilePhoto = 'overflow-hidden rounded-md bg-surface-container'

/**
 * shelf — сетка витрины. Колонок столько, сколько поместится при заданном
 * минимуме плитки: две на телефоне, три на планшете, четыре и пять
 * на широком экране. Само число колонок не задаётся вручную ни на одной
 * ступени — иначе сетка ломается на ширине, о которой никто не подумал.
 *
 * Минимумов два, и переключаются они на 768 (§ Layout, правка 20.09):
 * 160 телефону, 224 дальше. Одним числом две задачи не решаются — с 160
 * на 1440 рама резалась на восемь треков и карточки вставали мелочью
 * в левом углу, а с 224 на 375 отменялась вторая колонка.
 */
export const shelf =
  'grid gap-md sm:gap-lg ' +
  '[grid-template-columns:repeat(auto-fill,minmax(var(--spacing-tile-min),1fr))] ' +
  'md:[grid-template-columns:repeat(auto-fill,minmax(var(--spacing-tile-min-wide),1fr))]'

/** panel-nested — второй уровень, радиус 10, отступ 12. Глубже не вкладывать. */
export const panelNested = 'rounded-sm bg-surface-container-high p-md'

/**
 * action-bar — панель действий карточки предмета (§ Components, 20.09).
 * Холст с хайрлайном сверху, а не плашка: плашка вокруг кнопок читается
 * как вложенная карточка, а карточка внутри карточки запрещена.
 *
 * На телефоне — полоса внизу экрана поверх содержимого; на широком экране
 * это обычный блок внутри липкой боковой колонки, и фиксация ему не нужна
 * (её держит PageShell).
 */
export const actionBarFixed =
  'fixed inset-x-0 bottom-0 z-10 border-t border-outline bg-surface px-lg py-md lg:hidden'

/** Та же панель в боковой колонке: без фиксации, с хайрлайном сверху. */
export const actionBarSide = 'border-t border-outline pt-lg'

/**
 * Панель витрины (§ Layout, 22.09). От `actionBarFixed` отличается одним:
 * на широком экране она не прячется. У карточки предмета там есть боковая
 * колонка, у витрины её нет — сетка занимает всю раму, и уводить действие
 * некуда.
 */
export const actionBarShelf =
  'fixed inset-x-0 bottom-0 z-10 border-t border-outline bg-surface px-lg py-md'


/**
 * badge — бейдж поверх снимка: графит при 82% непрозрачности, надпись цветом
 * холста, радиус 10 (§ Components, правка 22.09). Сливовым он был до того,
 * как слива ушла из системы. Непрозрачность, а не сплошная заливка: под
 * бейджем лежит фотография, и полностью гасить её кусок незачем — снимок
 * здесь главное доказательство, что мастерская настоящая.
 */
export const badge =
  'inline-flex items-center rounded-sm bg-on-surface px-sm py-xs ' +
  'text-label tracking-label font-medium text-surface'

/** Тот же бейдж поверх снимка: 82% непрозрачности, чтобы фотография читалась. */
export const badgeOnPhoto =
  'inline-flex items-center rounded-sm bg-on-surface/82 px-sm py-xs ' +
  'text-label tracking-label font-medium text-surface'

/**
 * notice — плашка-уведомление (§ Components, 22.09). Последствие действия,
 * показанное ДО нажатия: стоит перед главной кнопкой, не после неё.
 * Говорит о том, что произойдёт, а не о том, как устроен продукт.
 * Красным не красится: это не ошибка.
 */
export const notice =
  'flex items-start gap-md rounded-md bg-surface-container p-lg ' +
  'text-body-sm tracking-body-sm text-on-surface'

/**
 * choice-card — карточка выбора: вариант, который объясняется рисунком
 * (§ Components, 22.09). Границы применимости — три условия сразу: вариантов
 * не больше четырёх, у каждого свой чертёж, подпись не длиннее двух слов.
 * Не проходит хотя бы одно — это строки, а не карточки.
 */
export const choiceCard = (selected: boolean) =>
  'flex min-h-target cursor-pointer flex-col items-center gap-sm rounded-md border p-md ' +
  'text-label tracking-label font-medium transition-colors duration-100 ' +
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ' +
  'has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2 ' +
  (selected
    ? 'border-primary bg-surface-container-high text-on-surface'
    : 'border-outline bg-surface text-on-surface hover:brightness-97')

/**
 * media-loading — предмет, который ждёт сети, занимает своё место сразу
 * (§ Состояния, 22.09). Не выключенная кнопка рядом и не строка под блоком:
 * человек должен видеть, что вещь уже в списке, иначе добавит её дважды.
 */
export const mediaLoading =
  'flex items-center justify-center rounded-md bg-surface-container text-on-surface-muted'

/**
 * callout — блок-призыв (§ Components, 22.09). Тёмный прямоугольник во всю
 * ширину: обещание, условие и одно действие. Один на экран — второе такое же
 * пятно гасит первое (§ «Выделяется то, что одно»).
 */
export const callout = 'rounded-lg bg-on-surface p-2xl text-surface'

/**
 * callout-button — единственное место, где кнопка красится брендом: внутри
 * тёмного блока графит слился бы с фоном.
 */
export const calloutButton =
  'inline-flex min-h-target items-center justify-center rounded-sm bg-brand px-xl py-md ' +
  'text-label tracking-label font-medium text-on-brand ' +
  'transition-[filter] duration-100 hover:brightness-92 active:brightness-88'

/**
 * Полоса шагов — дорожка и её пройденная часть (§ Components, 21.09).
 * Живёт только в кабинете мебельщика: в форме заявки счётчика шагов
 * нет и не будет — основание в «Записанных противоречиях» DESIGN.md.
 *
 * Радиус 0: это линия измерения, а не предмет. Ширина пройденной части
 * меняется мгновенно и не анимируется — движение разрешено цвету,
 * прозрачности и `transform`, а переход ширины пересчитывает раскладку
 * каждый кадр (§ Layout).
 */
export const stepBar = 'h-xs w-full bg-surface-container-high'
export const stepBarDone = 'h-full bg-primary'

/**
 * Галерея (§ Components, 21.09). Миниатюра 64 на 64, радиус 0 — как всякая
 * самостоятельная фотография. Выбранная обводится линией `primary` в 2px:
 * цвет один канал из трёх, контур — второй (§ Состояния).
 *
 * Обводка у невыбранной прозрачная, а не отсутствующая: иначе выбор сдвигал
 * бы полосу миниатюр на два пикселя — то же основание, что у строк выбора.
 */
export const galleryThumb = (selected: boolean) =>
  'size-4xl shrink-0 border-2 bg-surface-container object-cover ' +
  (selected ? 'border-primary' : 'border-transparent')

/**
 * Вкладки (§ Components, 21.09) — переключение между наборами одного рода.
 * Заливки нет: залитая вкладка спорит с кнопкой, а выбирают здесь не
 * действие, а что смотреть. Выбранная — цвет и линия снизу, два канала.
 */
export const tab = (selected: boolean) =>
  'min-h-target border-b-2 px-sm text-label tracking-label font-medium ' +
  (selected ? 'border-primary text-on-surface' : 'border-transparent text-on-surface-muted')

/**
 * Окно (§ Layout, 21.09) — единственное исключение из «шаг показывается
 * стадией страницы»: короткое сообщение о том, чего ещё нет. Формы внутри
 * не бывает, второго шага не бывает.
 *
 * Подложка — графит с прозрачностью: своего цвета для неё в системе нет
 * и заводить его незачем, это не смысл, а способ погасить фон.
 */
export const dialogScrim =
  'fixed inset-0 z-20 flex items-end justify-center bg-on-surface/40 p-lg sm:items-center'
export const dialogBox = 'w-full max-w-measure rounded-md bg-surface p-xl'

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

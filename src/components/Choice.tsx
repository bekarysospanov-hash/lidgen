// Строки выбора, общие для обеих зон. До этого они жили внутри RequestForm:
// форме заказчика хватало своих семи копий, и пока строка выбора была нужна
// одному экрану, выносить её было незачем.
//
// Теперь их два экрана — форма заявки и карточка мебельщика, где он отмечает
// услуги, рабочие дни и мессенджеры. Копия разошлась бы молча: правка отметки
// в одном месте не дошла бы до другого, и множественный выбор в кабинете
// остался бы с круглой точкой, которую § Shapes запрещает.
//
// Строй строки — из DESIGN.md § Components: иконка слева, название, под ним
// подсказка на 15px, отметка справа. Круг означает «одно из», квадрат
// с галочкой — «сколько нужно».
import { CheckMark } from './icons'
import { blockRow, blockRowDivider, choiceBox, choiceCard, choiceDot, hintText } from './ui'

export interface ChoiceRow<T extends string> {
  id: T
  label: string
  hint?: string
}

/** Обёртка списка: разделитель живёт на ней, чтобы не спорить с обводкой. */
export function Rows({ children }: { children: React.ReactNode }) {
  return <div className="-mx-md">{children}</div>
}

/** Отметка множественного выбора: квадрат с галочкой (§ Components). */
export function Box({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={choiceBox(on)}>
      {on && <CheckMark />}
    </span>
  )
}

/** Точка единичного выбора: круг, залитый зелёным у отмеченного. */
export function Dot({ on }: { on: boolean }) {
  return <span aria-hidden="true" className={choiceDot(on)} />
}

/**
 * Подпись строки подчёркивается при наведении на строку целиком: строка —
 * одна цель нажатия, и подчёркивание показывает, что нажимается вся она,
 * а не одна отметка справа.
 */
const optLabel = 'group-hover:underline underline-offset-4'

/**
 * «Отметьте сколько нужно». `icon` необязателен: у услуг мастерской слева
 * стоит знак, у дней недели и мессенджеров предметного образа нет, и строка
 * живёт без него — значок ради значка § Иконки запрещает прямо.
 */
export function CheckRows<T extends string>({ options, chosen, onToggle, icon }: {
  options: readonly ChoiceRow<T>[]
  chosen: readonly T[]
  onToggle: (id: T) => void
  icon?: (id: T) => React.ReactNode
}) {
  return (
    <Rows>
      {options.map((option, index) => {
        const on = chosen.includes(option.id)
        // Соседи по списку: идущие подряд отмеченные строки обводятся одной
        // рамкой на группу, иначе шесть рамок вплотную читаются зелёной
        // штриховкой (§ Components, правка 20.09).
        const prev = index > 0 && chosen.includes(options[index - 1].id)
        const next = index + 1 < options.length && chosen.includes(options[index + 1].id)
        return (
          <div key={option.id} className={blockRowDivider(on && next)}>
            <label className={blockRow(on, { afterSelected: prev, beforeSelected: next })}>
              <input type="checkbox" className="sr-only" checked={on}
                onChange={() => onToggle(option.id)} />
              {icon?.(option.id)}
              <span className="min-w-0">
                <span className={`block ${optLabel}`}>{option.label}</span>
                {option.hint !== undefined && option.hint !== '' && (
                  <span className={`mt-xs block ${hintText}`}>{option.hint}</span>
                )}
              </span>
              <Box on={on} />
            </label>
          </div>
        )
      })}
    </Rows>
  )
}

/** «Одно из»: отметив второе, человек снимает первое. */
export function ChoiceRows<T extends string>({ name, options, value, onPick, icon }: {
  name: string
  options: readonly ChoiceRow<T>[]
  value: T | null
  onPick: (id: T) => void
  icon?: (id: T) => React.ReactNode
}) {
  return (
    <Rows>
      {options.map((option) => (
        <div key={option.id} className={blockRowDivider()}>
          <label className={blockRow(value === option.id)}>
            <input type="radio" name={name} value={option.id} className="sr-only"
              checked={value === option.id} onChange={() => onPick(option.id)} />
            {icon?.(option.id)}
            <span className="min-w-0">
              <span className={`block ${optLabel}`}>{option.label}</span>
              {option.hint !== undefined && option.hint !== '' && (
                <span className={`mt-xs block ${hintText}`}>{option.hint}</span>
              )}
            </span>
            <Dot on={value === option.id} />
          </label>
        </div>
      ))}
    </Rows>
  )
}

/**
 * Карточки выбора — вариант, который объясняется рисунком (§ Components,
 * 22.09). Три условия применимости проверяются глазами при сборке экрана:
 * вариантов не больше четырёх, у каждого свой чертёж, подпись не длиннее
 * двух слов. Не проходит хотя бы одно — берутся `ChoiceRows`.
 *
 * Подсказка варианта здесь не показывается: в карточке её негде поставить,
 * не разорвав ряд, а объясняет вариант сам чертёж. Диктору она остаётся —
 * уходит в описание метки.
 */
export function ChoiceCards<T extends string>({ name, options, value, onPick, drawing }: {
  name: string
  options: readonly ChoiceRow<T>[]
  value: T | null
  onPick: (id: T) => void
  drawing: (id: T) => React.ReactNode
}) {
  return (
    /* Четыре варианта встают по два в ряд, три — по три: ряд из четырёх
       на 375 даёт 74 пикселя на карточку, и чертёж в ней перестаёт читаться. */
    <div className={`grid gap-sm ${options.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {options.map((option) => (
        <label key={option.id} className={choiceCard(value === option.id)}>
          <input type="radio" name={name} value={option.id} className="sr-only"
            aria-label={option.hint !== undefined && option.hint !== ''
              ? `${option.label}. ${option.hint}`
              : option.label}
            checked={value === option.id} onChange={() => onPick(option.id)} />
          {drawing(option.id)}
          <span className="text-center">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

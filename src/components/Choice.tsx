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
import { blockRow, blockRowDivider, choiceBox, choiceDot, hintText } from './ui'

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
      {options.map((option) => {
        const on = chosen.includes(option.id)
        return (
          <div key={option.id} className={blockRowDivider}>
            <label className={blockRow(on)}>
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
        <div key={option.id} className={blockRowDivider}>
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

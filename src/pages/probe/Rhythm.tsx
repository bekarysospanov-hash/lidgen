// PROBE: эталон вертикального ритма. Существует, чтобы выбрать числа для
// DESIGN.md глазами, а не рассуждением, и удаляется сразу после выбора.
//
// Почему настоящие тексты проекта, а не «Lorem ipsum»: ритм проверяется
// длиной реальных фраз. На выдуманном тексте ровно выглядит что угодно.
import { useState } from 'react'
import { PageShell } from '../../components/PageShell'
import { chip, field, fieldLabel, hintText, panel, panelNested } from '../../components/ui'

type Variant = 'now' | 'proposed'

/** Настоящие тексты проекта: форма заявки, карточка заявки, форма ответа. */
const TEXT = {
  eyebrow: 'Заявка',
  title: 'Расскажите, какая мебель вам нужна',
  lede: 'Семь коротких вопросов. Без замеров и звонков вслепую.',
  sectionOne: 'Что просят',
  bodyOne:
    'Кухня в новостройке, окно по центру стены. Хочется светлые фасады ' +
    'и высокие шкафы до потолка. Технику купим потом, сейчас важнее понять ' +
    'порядок цены.',
  sectionTwo: 'Подробности',
  rows: [
    ['Главный размер', '3,6 метра'],
    ['Форма', 'Угловая'],
    ['Город', 'Алматы, ЖК «Есентай»'],
    ['Срок', 'к Новому году'],
  ] as [string, string][],
  sectionThree: 'Ваш ответ',
  hintThree:
    'Одна заявка — один ответ. Ошиблись в вилке — ответ можно будет поправить, ' +
    'но вторым предложением он не станет.',
  fieldLabel: 'Что входит в решение',
  fieldHint: 'Своими словами, без названий плит и марок — их заказчица не поймёт.',
  quotePrice: '950 000 – 1 250 000 ₸',
  quoteLead: 'Срок изготовления: 30 дней',
} as const

export default function Rhythm() {
  const [variant, setVariant] = useState<Variant>('proposed')
  const now = variant === 'now'

  /**
   * Единственное место, где числа ритма стоят рядом и видны одним взглядом.
   * «Как сейчас» — не карикатура, а то, что реально стоит в коде: ширины
   * 58 и 54 знака вперемешку, отступ заголовок→текст то 8, то 16, колонка
   * не ограничена ничем, кроме страницы.
   */
  const r = now
    ? {
        column: 'max-w-none',
        title: 'max-w-measure-title',
        text: 'max-w-measure',
        textAlt: 'max-w-measure',
        titleToLede: 'mt-lg',
        headingToText: 'mt-md',
        headingToBlock: 'mt-lg',
      }
    : {
        // 58ch = 67 знаков русского текста в Golos Text 17px — измерено
        // на живой странице, оптимум чтения 66. 62ch дают 71 знак,
        // 54ch — 62: обе цифры внутри нормы, но дальше от оптимума.
        column: 'max-w-[45rem]',
        title: 'max-w-measure-title',
        text: 'max-w-measure',
        textAlt: 'max-w-measure',
        titleToLede: 'mt-lg',
        headingToText: 'mt-sm',
        headingToBlock: 'mt-lg',
      }

  return (
    <PageShell>
      <div className="flex flex-wrap gap-sm">
        <label className={chip(now)}>
          <input type="radio" name="variant" className="sr-only" checked={now}
            onChange={() => setVariant('now')} />
          <span>Как сейчас</span>
        </label>
        <label className={chip(!now)}>
          <input type="radio" name="variant" className="sr-only" checked={!now}
            onChange={() => setVariant('proposed')} />
          <span>Предложение</span>
        </label>
      </div>
      <p className={`mt-md ${hintText}`}>
        {now
          ? 'Ширины 62ch и 54ch вперемешку, отступ заголовок→текст 12, колонка не ограничена.'
          : 'Одна мера текста 58ch (67 знаков), заголовок 20ch, отступ 8, колонка 720.'}
      </p>

      <div className={`${r.column} mt-3xl`}>
        <p className={hintText}>{TEXT.eyebrow}</p>
        <h1 className={`mt-xs ${r.title} text-heading tracking-heading font-semibold text-balance`}>
          {TEXT.title}
        </h1>
        <p className={`${r.titleToLede} ${r.text} text-body tracking-body`}>{TEXT.lede}</p>

        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{TEXT.sectionOne}</h2>
          <p className={`${r.headingToText} ${r.text} text-body tracking-body`}>{TEXT.bodyOne}</p>
        </section>

        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{TEXT.sectionTwo}</h2>
          <div className={`${r.headingToBlock} ${panel} py-sm`}>
            {TEXT.rows.map(([label, value]) => (
              <div key={label} className="border-b border-outline py-md last:border-b-0">
                <p className={hintText}>{label}</p>
                <p className="mt-xs text-body tracking-body">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{TEXT.sectionThree}</h2>
          <p className={`${r.headingToText} ${r.textAlt} ${hintText}`}>{TEXT.hintThree}</p>

          <div className={`${r.headingToBlock} ${panel}`}>
            <label className="block" htmlFor="sample">
              <span className={fieldLabel}>{TEXT.fieldLabel}</span>
              <textarea id="sample" rows={3} defaultValue=""
                className={`mt-sm block w-full ${field()}`} />
            </label>
            <p className={`mt-xs ${hintText}`}>{TEXT.fieldHint}</p>

            <div className={`mt-xl ${panelNested}`}>
              <p className="text-subheading tracking-subheading font-medium tabular-nums">
                {TEXT.quotePrice}
              </p>
              <p className={`mt-xs ${hintText}`}>{TEXT.quoteLead}</p>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  )
}

import { useState } from 'react'
import { KitchenShape } from '../../components/KitchenShape'
import {
  categories,
  kitchenAppliances,
  kitchenShape,
  mainSize,
  screen,
  summary,
  type CategoryId,
} from '../../questions/categories'

/** Секция. Разделена волосяной линией — не отступом и не рамкой (DESIGN.md § Layout). */
function Section({ children }: { children: React.ReactNode }) {
  return <section className="border-t border-outline py-xl">{children}</section>
}

/** Вопрос. Обычный регистр: капс только у навигации, кнопок и полосы. */
function Ask({ title, hint, children }: {
  title: string; hint?: string; children: React.ReactNode
}) {
  return (
    <>
      <h2 className="text-subheading tracking-subheading">{title}</h2>
      {hint && <p className="mt-sm max-w-[62ch] text-body-sm tracking-body-sm">{hint}</p>}
      <div className="mt-lg">{children}</div>
    </>
  )
}

/** Индикатор: залитый квадрат. Радиус ноль, как у всего в системе. */
function Mark({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true"
      className={`mt-[0.2em] size-3 shrink-0 border ${on ? 'border-outline bg-primary' : 'border-outline'}`} />
  )
}

// Состояния по DESIGN.md § Состояния: наведение — подчёркивание подписи,
// нажатие — снижение непрозрачности. Цветом откликаться не на что, он один.
const opt =
  'group flex cursor-pointer items-start gap-sm bg-surface p-md text-left text-body-sm ' +
  'tracking-body-sm transition-opacity duration-100 active:opacity-70 ' +
  'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ' +
  'has-[:focus-visible]:outline-outline has-[:focus-visible]:outline-offset-2'

/** Подпись варианта: подчёркивается при наведении на карточку. */
const optLabel = 'group-hover:underline underline-offset-4'

const on = (v: boolean) => (v ? 'border-2 border-outline' : 'border border-outline')

export default function RequestForm() {
  const [category, setCategory] = useState<CategoryId | null>(null)
  const [size, setSize] = useState('')
  const [sizeUnknown, setSizeUnknown] = useState(false)
  const [shape, setShape] = useState<string | null>(null)
  const [appliances, setAppliances] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isKitchen = category === 'kitchen'
  const answered = sizeUnknown || size.trim().length > 0

  const L = summary.labels
  const rows: [string, string][] = []
  if (category) rows.push([L.category, categories.find((c) => c.id === category)!.label])
  if (isKitchen && sizeUnknown) rows.push([L.size, L.sizeUnknown])
  else if (isKitchen && size.trim()) rows.push([L.size, `${size.trim()} ${mainSize.unit}`])
  if (shape) rows.push([L.shape, kitchenShape.options.find((o) => o.id === shape)!.label])
  if (appliances)
    rows.push([L.appliances, kitchenAppliances.options.find((o) => o.id === appliances)!.label])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (isKitchen && !answered) {
      setError(mainSize.errorEmpty)
      document.getElementById('main-size')?.focus()
      return
    }
    setError(null)
    // PROBE: контракт ещё не описан, отправлять некуда. Следующий шаг — src/contract.
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      {/* Навигация: капс, через запятую, без фона и рамки */}
      <header className="mx-auto flex w-full max-w-[1440px] flex-wrap items-baseline gap-x-xl gap-y-sm px-lg pt-lg pb-xl text-caps tracking-caps uppercase">
        <span className="lowercase">мастерская</span>
        <nav className="flex flex-wrap gap-x-xl gap-y-sm">
          <a href="/" className="whitespace-nowrap underline-offset-4 transition-opacity duration-100 hover:underline active:opacity-70">Заявка</a>
          <a href="/masters" className="whitespace-nowrap underline-offset-4 transition-opacity duration-100 hover:underline active:opacity-70">Мастерские</a>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-lg">
        <h1 className="max-w-[20ch] text-heading tracking-heading">{screen.title}</h1>
        <p className="mt-lg max-w-[58ch] text-body tracking-body">{screen.lede}</p>

        <form onSubmit={submit} className="mt-xl">
          <Section>
            <Ask title={screen.stepCategory}>
              <div className="grid grid-cols-1 gap-sm sm:grid-cols-4">
                {categories.map((c) => (
                  <label key={c.id} className={`${opt} flex-col ${on(category === c.id)}`}>
                    <input type="radio" name="category" value={c.id} className="sr-only"
                      checked={category === c.id}
                      onChange={() => { setCategory(c.id); setError(null) }} />
                    <Mark on={category === c.id} />
                    <span className={`mt-sm block ${optLabel}`}>{c.label}</span>
                  </label>
                ))}
              </div>
            </Ask>
          </Section>

          {isKitchen && (
            <>
              <Section>
                <Ask title={mainSize.question} hint={mainSize.hint}>
                  <div className="flex items-baseline gap-sm">
                    <input id="main-size" inputMode="decimal" autoComplete="off"
                      value={size} disabled={sizeUnknown} placeholder={mainSize.placeholder}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'size-error' : undefined}
                      onChange={(e) => { setSize(e.target.value); setError(null) }}
                      className={`w-40 border-0 border-b bg-surface px-xs py-sm text-body
                        tracking-body tabular-nums transition-opacity duration-100
                        placeholder:opacity-40 hover:opacity-70 active:opacity-70
                        disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40
                        ${error ? 'border-stroke-signal' : 'border-outline'}`} />
                    <span className="text-body-sm tracking-body-sm">{mainSize.unit}</span>
                  </div>
                  <label className={`${opt} mt-lg inline-flex items-center ${on(sizeUnknown)}`}>
                    <input type="checkbox" className="sr-only" checked={sizeUnknown}
                      onChange={(e) => { setSizeUnknown(e.target.checked); setError(null) }} />
                    <Mark on={sizeUnknown} />
                    <span className={`whitespace-nowrap ${optLabel}`}>{mainSize.unknownLabel}</span>
                  </label>
                  {/* Сообщение чёрным: красный в этой системе — только линия */}
                  <div className="mt-md min-h-[1.5lh] max-w-[58ch] text-body-sm tracking-body-sm">
                    {error && <p id="size-error" role="alert">{error}</p>}
                    {!error && sizeUnknown && <p>{mainSize.unknownNote}</p>}
                  </div>
                </Ask>
              </Section>

              <Section>
                <Ask title={kitchenShape.question} hint={kitchenShape.hint}>
                  <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
                    {kitchenShape.options.map((o) => (
                      <label key={o.id} className={`${opt} flex-col ${on(shape === o.id)}`}>
                        <input type="radio" name="shape" value={o.id} className="sr-only"
                          checked={shape === o.id} onChange={() => setShape(o.id)} />
                        <span className="flex w-full items-start justify-between">
                          {/* Схема занимает место фотографии — в рамке волосяной линией */}
                          <span className="border border-outline p-sm">
                            <KitchenShape id={o.id} />
                          </span>
                          <Mark on={shape === o.id} />
                        </span>
                        <span className={`mt-md block ${optLabel}`}>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </Ask>
              </Section>

              <Section>
                <Ask title={kitchenAppliances.question} hint={kitchenAppliances.hint}>
                  <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
                    {kitchenAppliances.options.map((o) => (
                      <label key={o.id} className={`${opt} items-center ${on(appliances === o.id)}`}>
                        <input type="radio" name="appliances" value={o.id} className="sr-only"
                          checked={appliances === o.id} onChange={() => setAppliances(o.id)} />
                        <Mark on={appliances === o.id} />
                        <span className={optLabel}>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </Ask>
              </Section>
            </>
          )}

          {category && (
            <Section>
              <div className="flex flex-col gap-xl sm:flex-row sm:items-end sm:justify-between">
                <dl className="text-body-sm tracking-body-sm">
                  <p className="text-caps tracking-caps uppercase">{summary.title}</p>
                  {rows.map(([k, v]) => (
                    <div key={k} className="mt-sm flex gap-md">
                      <dt className="w-40 shrink-0 opacity-60">{k}</dt>
                      <dd className="min-w-0 tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <button type="submit"
                    className="bg-primary px-2xl py-lg text-caps tracking-caps whitespace-nowrap
                      text-on-primary uppercase transition-opacity duration-100 hover:opacity-80
                      active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40">
                    {screen.submit}
                  </button>
                  {sizeUnknown && (
                    <p className="mt-md max-w-[40ch] text-body-sm tracking-body-sm">
                      {screen.incompleteNote}
                    </p>
                  )}
                </div>
              </div>
            </Section>
          )}
        </form>
      </main>

      {/* Терминальная полоса — единственное место, где цвет занимает площадь */}
      {/* design-ok: bg-terminal — это и есть та самая полоса, DESIGN.md § Colors */}
      <div className="mt-2xl flex items-center bg-terminal px-lg py-md text-caps tracking-caps text-on-terminal uppercase">
        Мастерские Алматы, Астаны и Шымкента
      </div>
    </div>
  )
}

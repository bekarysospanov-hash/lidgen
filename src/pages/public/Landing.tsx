// US-01 — лендинг с оффером. Первый экран без прокрутки отвечает на три
// вопроса: что предлагают, что требуется от меня, куда нажимать.
//
// Фотографии здесь не украшение, а проверка самой системы: DESIGN.md выведен
// из витрины мебельной галереи, где белизна и волосяные линии обслуживают
// большие снимки мебели. Без снимков остаётся один каркас.
//
// PROBE: снимки в src/assets/probe — случайные кадры, а не портфолио мастерских.
// Заменяются реальными работами до GATE 1 (трек A1). См. src/assets/probe/README.md
import { Link } from 'react-router-dom'
import bedroom from '../../assets/probe/bedroom.jpg'
import cabinet from '../../assets/probe/cabinet.jpg'
import kitchen from '../../assets/probe/kitchen.jpg'
import { PageShell } from '../../components/PageShell'
import { landing } from '../../texts/landing'

/** Кнопка главного действия: чёрный прямоугольник, белый капс, радиус ноль. */
const button =
  'inline-block bg-primary px-2xl py-lg text-caps tracking-caps uppercase ' +
  'text-on-primary transition-opacity duration-100 hover:opacity-80 ' +
  'active:opacity-70 focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-outline focus-visible:outline-offset-2'

/** Снимок в волосяной рамке — так система показывает изображение. */
function Shot({ src, alt, ratio }: { src: string; alt: string; ratio: string }) {
  return (
    <div className="border border-outline p-sm">
      <img src={src} alt={alt} loading="lazy"
        className={`w-full max-w-full ${ratio} object-cover`} />
    </div>
  )
}

export default function Landing() {
  return (
    <PageShell>
      {/* Обещание и кнопка — выше сгиба, до всякой прокрутки (US-01) */}
      <section className="pt-lg pb-2xl">
        <h1 className="max-w-[16ch] text-heading tracking-heading text-balance">
          {landing.promise}
        </h1>
        <p className="mt-lg max-w-[54ch] text-body tracking-body">{landing.lede}</p>
        <div className="mt-xl">
          <Link to="/request" className={button}>{landing.cta}</Link>
          <p className="mt-md max-w-[44ch] text-body-sm tracking-body-sm">
            {landing.ctaNote}
          </p>
        </div>
      </section>

      {/* Главный снимок. Ради него система и построена такой пустой */}
      <section className="border-t border-outline py-xl">
        <Shot src={kitchen} alt={landing.works.alt.kitchen}
          ratio="aspect-[3/2]" />
      </section>

      <section className="border-t border-outline py-xl">
        <h2 className="text-subheading tracking-subheading">{landing.how.title}</h2>
        <ol className="mt-xl grid grid-cols-1 gap-xl sm:grid-cols-3">
          {landing.how.steps.map((step) => (
            <li key={step.n}>
              {/* Номер шага — не украшение: порядок здесь несёт смысл */}
              <p className="text-body-sm tracking-body-sm tabular-nums">{step.n}</p>
              <h3 className="mt-sm text-body tracking-body text-balance">{step.title}</h3>
              <p className="mt-sm max-w-[38ch] text-body-sm tracking-body-sm">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-outline py-xl">
        <h2 className="text-subheading tracking-subheading">{landing.works.title}</h2>
        <p className="mt-sm max-w-[54ch] text-body-sm tracking-body-sm">
          {landing.works.note}
        </p>
        <div className="mt-xl grid grid-cols-1 gap-md sm:grid-cols-2">
          <Shot src={bedroom} alt={landing.works.alt.bedroom}
            ratio="aspect-[3/4]" />
          <Shot src={cabinet} alt={landing.works.alt.cabinet}
            ratio="aspect-[3/4]" />
        </div>
      </section>

      <section className="border-t border-outline py-xl">
        <h2 className="text-subheading tracking-subheading">{landing.catalogue.title}</h2>
        <p className="mt-sm max-w-[54ch] text-body-sm tracking-body-sm">
          {landing.catalogue.body}
        </p>
        <div className="mt-xl">
          <Link to="/request" className={button}>{landing.cta}</Link>
        </div>
      </section>
    </PageShell>
  )
}

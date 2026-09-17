// US-01 — лендинг с оффером. Первый экран без прокрутки отвечает на три
// вопроса: что предлагают, что требуется от меня, куда нажимать.
//
// Фотографии здесь не украшение, а проверка самой системы: DESIGN.md выведен
// из витрины мебельной галереи, где белизна и волосяные линии обслуживают
// большие снимки мебели. Без снимков остаётся один каркас.
//
// PROBE: снимки в src/assets/probe — случайные кадры, а не портфолио мастерских.
// Заменяются реальными работами до GATE 1 (трек A1). См. src/assets/probe/README.md
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { track } from '../../analytics'
import bedroom from '../../assets/probe/bedroom.jpg'
import cabinet from '../../assets/probe/cabinet.jpg'
import kitchen from '../../assets/probe/kitchen.jpg'
import { PageShell } from '../../components/PageShell'
import { buttonFilled, hintText, link, panel } from '../../components/ui'
import { landing, probePanel } from '../../texts/landing'
import { probeText } from '../../texts/probe'
import { lastRequest } from '../../probe-trail'

/**
 * Снимок — радиус 0 и без рамки (DESIGN.md § Components, § Shapes).
 * Прежняя волосяная рамка пришла из отменённой системы: там она заменяла
 * границу кадра, здесь кадр держит сам себя, а обводок у блоков нет.
 */
function Shot({ src, alt, ratio }: { src: string; alt: string; ratio: string }) {
  return (
    <img src={src} alt={alt} loading="lazy"
      className={`w-full max-w-full ${ratio} object-cover`} />
  )
}

export default function Landing() {
  // PROBE: след последней заявки этой вкладки — см. probe-trail.ts.
  const trail = lastRequest()
  /**
   * Сколько карточек в каталоге. Ноль — блок о мастерских не показывается
   * вовсе (US-02). Отказ операции считается нулём: обещать каталог, которого
   * не удалось прочитать, хуже, чем промолчать.
   */
  const [catalogueSize, setCatalogueSize] = useState(0)

  useEffect(() => {
    api.listMasters().then(
      (masters) => setCatalogueSize(masters.length),
      () => setCatalogueSize(0),
    )
  }, [])

  return (
    <PageShell>
      {/* Обещание и кнопка — выше сгиба, до всякой прокрутки (US-01) */}
      <section className="pt-lg pb-2xl">
        {/* Единственный display на странице — так велит шкала (§ Typography). */}
        <h1 className="max-w-measure-title text-display tracking-display font-semibold text-balance">
          {landing.promise}
        </h1>
        <p className="mt-lg max-w-measure text-body tracking-body">{landing.lede}</p>
        <div className="mt-xl">
          {/* US-01: переход к форме — шаг воронки. Считается один раз
              за сессию: интересен факт перехода, а не число нажатий. */}
          <Link to="/request" className={buttonFilled} onClick={() => track('continue_clicked')}>
            {landing.cta}
          </Link>
          <p className={`mt-md max-w-measure ${hintText}`}>
            {landing.ctaNote}
          </p>
        </div>
      </section>

      {/* Главный снимок: во всю ширину колонки, радиус 0, без рамки */}
      <section className="mt-3xl">
        <Shot src={kitchen} alt={landing.works.alt.kitchen}
          ratio="aspect-[3/2]" />
      </section>

      <section className="mt-3xl">
        <h2 className="text-subheading tracking-subheading font-medium">{landing.how.title}</h2>
        {/* Шаг — плашка: номер, заголовок и пояснение читаются как одно целое,
            и три плашки рядом показывают, что шагов ровно три. */}
        <ol className="mt-xl grid grid-cols-1 gap-md sm:grid-cols-3">
          {landing.how.steps.map((step) => (
            <li key={step.n} className={panel}>
              {/* Номер шага — не украшение: порядок здесь несёт смысл */}
              <p className={`tabular-nums ${hintText}`}>{step.n}</p>
              <h3 className="mt-xs text-body tracking-body font-medium text-balance">{step.title}</h3>
              <p className={`mt-sm max-w-measure ${hintText}`}>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-3xl">
        <h2 className="text-subheading tracking-subheading font-medium">{landing.works.title}</h2>
        <p className={`mt-sm max-w-measure ${hintText}`}>
          {landing.works.note}
        </p>
        <div className="mt-xl grid grid-cols-1 gap-md sm:grid-cols-2">
          <Shot src={bedroom} alt={landing.works.alt.bedroom}
            ratio="aspect-[3/4]" />
          <Shot src={cabinet} alt={landing.works.alt.cabinet}
            ratio="aspect-[3/4]" />
        </div>
      </section>

      {/* PROBE: две двери для того, кто смотрит пробу. Без этого блока
          кабинет мебельщика открывается только правкой адреса руками —
          с телефона это невозможно. Исчезает вместе с моками. */}
      {probeText !== null && (
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{probePanel.title}</h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{probePanel.body}</p>
          <div className={`mt-lg ${panel}`}>
            <div className="flex flex-col gap-md">
              <Link to="/request" className={link}>{probePanel.toRequest}</Link>
              <span>
                <Link to="/master" className={link}>{probePanel.toMaster}</Link>
                <span className={`mt-xs block ${hintText}`}>{probePanel.masterNote}</span>
              </span>
              {/* Третья дверь появляется, только когда заявка уже оставлена
                  в этой вкладке: возвращает к своим предложениям внутренним
                  переходом, без копирования адреса. */}
              {trail && (
                <span>
                  <Link to={`/offers/${trail.token}`} className={link}>
                    {probePanel.toOffers(trail.number)}
                  </Link>
                  <span className={`mt-xs block ${hintText}`}>{probePanel.offersNote}</span>
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* US-02: блок каталога появляется, только когда в каталоге кто-то есть.
          Пустая сетка и карточки-заглушки запрещены — до первых согласий
          лендинг о мастерских молчит, а не обещает то, чего нет. */}
      {catalogueSize > 0 && (
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{landing.catalogue.title}</h2>
          <p className={`mt-sm max-w-measure ${hintText}`}>
            {landing.catalogue.body}
          </p>
          <p className="mt-lg">
            <Link to="/masters" className={link}>{landing.catalogue.link}</Link>
          </p>
        </section>
      )}

      <section className="mt-3xl">
        <div>
          <Link to="/request" className={buttonFilled} onClick={() => track('continue_clicked')}>
            {landing.cta}
          </Link>
        </div>
      </section>
    </PageShell>
  )
}

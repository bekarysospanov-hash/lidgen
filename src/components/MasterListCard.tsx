// Карточка мастерской в списке — US-02. Отдельным компонентом, потому что
// нужна в двух местах: в каталоге и в кабинете, где мебельщик смотрит
// на себя глазами заказчика. Две копии разошлись бы в первый же день,
// и предпросмотр перестал бы быть предпросмотром.
//
// Порядок блоков — из бенчмарка мебельных площадок (18.09): работа сверху,
// дальше кто и где, потом что входит в работу. На изученных каталогах фото
// работы — главный аргумент выбора, а логотип и история компании в списке
// не решают ничего.
import { Link } from 'react-router-dom'
import type { MasterCardPublic } from '../contract'
import { cityName } from '../questions/categories'
import { serviceText } from '../questions/services'
import { leadTime, warranty } from '../texts/format'
import { mastersPage } from '../texts/masters'
import { ServiceIcon } from './ServiceIcon'
import { hintText, link, panel } from './ui'

/**
 * Сколько услуг показывает карточка списка. Четыре — не круглое число,
 * а мера: подписи здесь длиной до 21 знака («Нестандартные размеры»),
 * в строку на 375px их встаёт ровно одна, и список идёт столбиком. Четыре
 * строки — предел, после которого карточка перестаёт читаться за один
 * взгляд. Остальные считаются числом — «ещё 2», и это честнее обрезанного
 * списка.
 */
const SERVICES_IN_LIST = 4

export function MasterListCard({ master, asPreview = false }: {
  master: MasterCardPublic
  /** В предпросмотре ссылка никуда не ведёт: мебельщик смотрит, а не ходит. */
  asPreview?: boolean
}) {
  const { card } = master
  const shown = card.services.slice(0, SERVICES_IN_LIST)
  const hidden = card.services.length - shown.length
  const cover = card.photos[0]

  // Срок и гарантия — одной строкой и только если названы. Прочерк на месте
  // несказанного читается как «нет гарантии», а это неправда: её не назвали.
  const terms = [
    card.leadTime !== null ? `${mastersPage.leadLabel} ${leadTime(card.leadTime)}` : null,
    card.warrantyMonths !== null
      ? `${mastersPage.warrantyLabel} ${warranty(card.warrantyMonths)}`
      : null,
  ].filter((item) => item !== null)

  return (
    <div className={panel}>
      {/* Работа первой, до имени: в каталоге мастерскую выбирают глазами,
          и снимок кухни говорит о ней больше, чем название (§ Presence). */}
      {cover !== undefined && (
        <figure className="-mx-xl -mt-xl mb-lg">
          <img src={cover.url} alt={cover.caption ?? ''}
            className="aspect-[3/2] w-full bg-surface-container object-cover" />
          {cover.isRender && (
            <figcaption className={`mt-xs px-xl ${hintText}`}>{mastersPage.renderMark}</figcaption>
          )}
        </figure>
      )}

      <p className="text-subheading tracking-subheading font-medium">{master.name}</p>
      {/* tabular-nums: карточки идут столбцом, и годы со сроками читаются
          по вертикали — без него «12 лет» и «4 года» гуляют по ширине. */}
      <p className={`mt-xs tabular-nums ${hintText}`}>
        {cityName(master.city)} · {mastersPage.yearsLabel(card.yearsOnMarket)}
      </p>
      {card.serviceArea !== null && (
        <p className={`mt-xs ${hintText}`}>
          {mastersPage.areaLabel}: {card.serviceArea}
        </p>
      )}

      {/* Незаполненное направление не показывается вовсе: метка «Делает»
          с пустотой под ней читается как «ничего не делает». В каталог такая
          карточка не попадёт — схема требует направление, — но предпросмотр
          рисует и наполовину заполненный черновик. */}
      {card.does.length > 0 && (
        <>
          <p className={`mt-lg ${hintText}`}>{mastersPage.doesLabel}</p>
          <p className="mt-xs text-body tracking-body">{card.does.join(' · ')}</p>
        </>
      )}

      {/* Столбиком, а не в строку: каркас держит колонка значков слева
          (§ Components), и «ещё 2» стоит отдельной строкой — в одной строке
          с последней услугой оно читалось бы как часть подписи. */}
      {shown.length > 0 && (
        <ul className="mt-lg flex flex-col gap-sm">
          {shown.map((service) => (
            <li key={service.id} className={`flex items-center gap-sm ${hintText}`}>
              <ServiceIcon id={service.id} />
              <span>
                {serviceText(service.id).label}
                {/* Условие рядом с услугой: без него два одинаковых списка
                    несравнимы — у одного монтаж в цене, у другого отдельно. */}
                {service.paid && ` — ${mastersPage.servicePaid}`}
              </span>
            </li>
          ))}
          {hidden > 0 && (
            <li className={`ml-icon pl-sm ${hintText}`}>{mastersPage.servicesMore(hidden)}</li>
          )}
        </ul>
      )}

      {terms.length > 0 && (
        <p className={`mt-sm tabular-nums ${hintText}`}>{terms.join(' · ')}</p>
      )}

      {!asPreview && (
        <p className="mt-lg">
          <Link to={`/masters/${master.id}`} className={link}>
            {mastersPage.openCard}
          </Link>
        </p>
      )}
    </div>
  )
}

// Плитка витрины — карточка мастерской в сетке каталога (US-02).
//
// Отличается от карточки-документа, которая жила здесь до 20.09: та была
// блоком в колонке 720 и перечисляла всё, что знает. Плитка стоит в сетке
// рядом с восемью такими же, и её работа другая — за один взгляд сказать,
// стоит ли открывать. Поэтому фото-крышка, имя, одна строка о мастерской,
// направления и две метки фактов; всё остальное — внутри карточки.
//
// Плитка целиком — одна цель нажатия (DESIGN.md § Components): человек метит
// в карточку, а не в ссылку внутри неё.
import { Link } from 'react-router-dom'
import type { MasterCardPublic } from '../contract'
import { cityName } from '../questions/categories'
import { serviceText } from '../questions/services'
import { leadTime, warranty } from '../texts/format'
import { mastersPage } from '../texts/masters'
import { badge, hintText, tile, tilePhoto } from './ui'

/**
 * Метки фактов. Больше двух не ставим: третья превращает витрину в ярмарку
 * и не читается ни одна (§ Components). Берём только то, что мастерская
 * сказала о себе сама, — бесплатный замер и оплату частями спрашивают чаще
 * прочего, и именно по ним отсеивают на первом взгляде.
 */
const BADGE_SERVICES = ['measure', 'installments'] as const

export function MasterTile({ master }: { master: MasterCardPublic }) {
  const { card } = master
  const cover = card.photos[0]

  const badges = BADGE_SERVICES.flatMap((id) => {
    const offer = card.services.find((service) => service.id === id)
    // Услуга за отдельную плату меткой не становится: метка обещает выгоду,
    // а «замер за деньги» — не выгода, это обычный порядок.
    return offer !== undefined && !offer.paid ? [serviceText(id).label] : []
  }).slice(0, 2)

  return (
    <Link to={`/masters/${master.id}`} className={tile}>
      {/* Фото-крышка: скруглена не она, а плитка — снимок обрезан по её
          границе сверху (§ Shapes, правка 20.09). */}
      <span className={`block aspect-[4/3] w-full overflow-hidden rounded-t-lg ${tilePhoto}`}>
        {cover !== undefined && (
          <img src={cover.url} alt={cover.caption ?? ''}
            className="h-full w-full object-cover" />
        )}
      </span>

      <span className="flex flex-1 flex-col p-lg">
        <span className="block text-subheading tracking-subheading font-medium">
          {master.name}
        </span>
        <span className={`mt-xs block tabular-nums ${hintText}`}>
          {cityName(master.city)} · {mastersPage.yearsLabel(card.yearsOnMarket)}
        </span>

        {/* Направления одной строкой: в сетке место дороже, чем в документе,
            и перечень в три строки съедает плитку. */}
        <span className="mt-sm block text-body tracking-body">
          {card.does.join(' · ')}
        </span>

        {badges.length > 0 && (
          <span className="mt-md flex flex-wrap gap-xs">
            {badges.map((label) => (
              <span key={label} className={badge}>{label}</span>
            ))}
          </span>
        )}

        {/* Срок и гарантия прижаты к низу: у соседних плиток разное число
            строк выше, и без этого числа гуляли бы по вертикали. */}
        <span className={`mt-auto pt-md tabular-nums ${hintText}`}>
          {[
            card.leadTime !== null ? leadTime(card.leadTime) : null,
            card.warrantyMonths !== null
              ? `${mastersPage.warrantyLabel} ${warranty(card.warrantyMonths)}`
              : null,
          ]
            .filter((item) => item !== null)
            .join(' · ') || mastersPage.noRating}
        </span>
      </span>
    </Link>
  )
}

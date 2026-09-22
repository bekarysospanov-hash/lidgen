// Плитка витрины — карточка мастерской в сетке каталога (US-02).
//
// Пересобрана 20.09 под мобильный маркетплейс: на телефоне в ряд стоят две
// плитки по 163 пикселя, и всё, что не помещается в этот столбик, из неё
// убрано. Осталось то, по чему выбирают за один взгляд: работа, имя, город,
// направление и одна метка. Условия, услуги и рассказ — внутри карточки.
//
// Плитка целиком — одна цель нажатия (DESIGN.md § Components): человек метит
// в карточку, а не в ссылку внутри неё.
import { Link } from 'react-router-dom'
import type { MasterCardPublic } from '../contract'
import { cityName } from '../questions/categories'
import { serviceText } from '../questions/services'
import { leadTime } from '../texts/format'
import { mastersPage } from '../texts/masters'
import { badgeOnPhoto, hintText, tile, tilePhoto } from './ui'

/**
 * Метка на плитке одна, а не две. На 163 пикселях вторая уходит на свою
 * строку и ломает низ ряда; выбирать между «бесплатный замер» и «оплата
 * частями» не нужно — первое спрашивают чаще.
 */
const BADGE_SERVICE = 'measure' as const

export function MasterTile({ master }: { master: MasterCardPublic }) {
  const { card } = master
  const cover = card.photos[0]
  const measure = card.services.find((service) => service.id === BADGE_SERVICE)
  // Услуга за отдельную плату меткой не становится: метка обещает выгоду,
  // а «замер за деньги» — обычный порядок, а не выгода.
  const showBadge = measure !== undefined && !measure.paid

  return (
    <Link to={`/masters/${master.id}`} className={tile}>
      {/* Снимок сам и есть плитка (§ Shapes, правка 22.09): подложки под
          ним нет, скругление по md. Квадрат, а не 4:3: в двух колонках
          он даёт больше предмета на той же высоте столбца. */}
      <span className={`relative block aspect-square w-full ${tilePhoto}`}>
        {cover !== undefined && (
          <img src={cover.url} alt={cover.caption ?? ''}
            className="h-full w-full object-cover" />
        )}
        {showBadge && (
          <span className={`absolute top-sm left-sm ${badgeOnPhoto}`}>
            {serviceText(BADGE_SERVICE).label}
          </span>
        )}
      </span>

      <span className="mt-md flex flex-1 flex-col">
        {/* Имя — ступень body с весом, а не subheading: в двух колонках
            22 пикселя ломают название на три строки. */}
        <span className="block text-body tracking-body font-medium">{master.name}</span>

        {/* Первое направление, а не все: перечень через « · » в 163 пикселя
            превращается в три строки мелкого текста. */}
        <span className={`mt-xs block ${hintText}`}>
          {card.does[0]}
          {card.does.length > 1 && ` +${card.does.length - 1}`}
        </span>

        <span className={`mt-auto pt-sm tabular-nums ${hintText}`}>
          {cityName(master.city)}
          {card.leadTime !== null && ` · ${leadTime(card.leadTime)}`}
        </span>

        {/* Отзывов в пробе нет: место под оценку занято честной строкой,
            выдуманное число рейтинга система запрещает (§ Presence). */}
        <span className={`mt-xs block ${hintText}`}>{mastersPage.noRating}</span>
      </span>
    </Link>
  )
}

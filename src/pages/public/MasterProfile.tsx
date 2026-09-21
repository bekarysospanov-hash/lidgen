// US-03 — карточка одной мастерской. Раскрывает то, что в каталоге показано
// кратко: полный рассказ, все направления, что входит в работу, сроки,
// гарантия, часы и все работы.
//
// Телефона здесь нет и не будет в пробе. Контакт приходит вместе с
// предложением (US-24, контракт §2): мастерская отвечает конкретному
// заказчику и знает, что по её ответу позвонят. Раздавать телефоны в каталоге —
// значит уводить сделку мимо продукта и терять единственную метрику, которая
// у пробы есть. Но молчать об этом нельзя: человек ищет глазами номер и,
// не найдя, решает, что мастерская недоступна, — поэтому причина сказана
// словами перед кнопкой.
//
// Заявка из карточки всё равно веерная (PRD US-03): кнопка ведёт на общую
// форму, и строка под ней говорит об этом прямо.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { PageShell } from '../../components/PageShell'
import { format as formatPhone } from '../../components/phone'
import { HoursIcon, LeadTimeIcon, QuoteIcon, SafeDealIcon, WarrantyIcon } from '../../components/icons'
import {
  actionBarFixed,
  actionBarSide,
  badge,
  buttonFilled,
  buttonText,
  dialogBox,
  dialogScrim,
  galleryThumb,
  hintText,
  link,
  panel,
  tab,
} from '../../components/ui'
import type { CategoryId, MasterCardPublic, MasterPhoto } from '../../contract'
import { z } from 'zod'
import { cityName } from '../../questions/categories'
import { serviceText } from '../../questions/services'
import { leadTime, warranty, workHours } from '../../texts/format'
import { track } from '../../analytics'
import { masterCardPage, mastersPage } from '../../texts/masters'
import { ServiceIcon } from '../../components/ServiceIcon'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; master: MasterCardPublic }
  | { kind: 'missing' }
  | { kind: 'failed' }

/** Порядок разделов со снимками. Тот же, что у категорий заявки. */
const PHOTO_ORDER: readonly CategoryId[] = ['kitchen', 'wardrobe', 'bathroom', 'other']

/**
 * Окно «скоро» — единственное окно продукта (§ Layout, 21.09). Вынесено
 * компонентом, чтобы доступность жила в одном месте: `aria-modal` обещает
 * экранному диктору, что за окном ничего нет, и обещание надо исполнять.
 *
 * Три вещи, без которых обещание ложно: Escape закрывает, фокус уходит
 * на кнопку при открытии и возвращается на то, откуда пришёл, при закрытии.
 */
function SoonDialog({ onClose, title, children }: {
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const cameFrom = useRef<HTMLElement | null>(null)

  useEffect(() => {
    cameFrom.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      cameFrom.current?.focus()
    }
  }, [onClose])

  return (
    <div className={dialogScrim} role="dialog" aria-modal="true" aria-label={title}
      onClick={onClose}>
      <div className={dialogBox} onClick={(event) => event.stopPropagation()}>
        <p className="text-subheading tracking-subheading font-medium">{title}</p>
        {children}
        <button ref={closeRef} type="button" className={`mt-xl ${buttonFilled}`} onClick={onClose}>
          {masterCardPage.dealSoonClose}
        </button>
      </div>
    </div>
  )
}

/**
 * Галерея (§ Components, 21.09): крупный снимок, полоса миниатюр и счётчик.
 *
 * Зачем счётчик. Миниатюр на 375px влезает четыре, а снимков у мастерской
 * до двенадцати — без «3 из 8» человек не знает ни докуда долистал,
 * ни сколько осталось.
 *
 * Листание идёт по воле человека: снимок не меняется сам и не крутится
 * по таймеру — движение принадлежит состояниям (§ Layout).
 */
function Gallery({ photos }: { photos: readonly MasterPhoto[] }) {
  const [at, setAt] = useState(0)
  /**
   * Индекс подрезается по длине списка, а не берётся как есть: снимков
   * может стать меньше, чем было выбрано (карточку правят), и тогда
   * галерея исчезала бы целиком вместо того, чтобы показать первый кадр.
   */
  const current = photos[Math.min(at, photos.length - 1)]
  if (current === undefined) return null

  return (
    <figure className="mt-lg">
      <img src={current.url} alt={current.caption ?? ''}
        className="aspect-[3/2] w-full bg-surface-container object-cover" />

      <figcaption className="mt-xs flex flex-wrap items-baseline gap-x-md">
        <span className={`tabular-nums ${hintText}`}>
          {masterCardPage.galleryCounter(at + 1, photos.length)}
        </span>
        {current.isRender && <span className={hintText}>{mastersPage.renderMark}</span>}
        {current.caption !== null && (
          <span className={`w-full ${hintText}`}>{current.caption}</span>
        )}
      </figcaption>

      {/* Полоса миниатюр — только когда есть что листать: одна миниатюра
          под одним снимком повторяет его и ничего не переключает. */}
      {photos.length > 1 && (
        <ul className="mt-md flex gap-sm overflow-x-auto">
          {photos.map((photo, index) => (
            <li key={photo.url}>
              <button type="button" onClick={() => setAt(index)}
                aria-label={masterCardPage.galleryPick(index + 1)}
                aria-current={index === at}>
                <img src={photo.url} alt="" className={galleryThumb(index === at)} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}

/**
 * Факт с иконкой и подписью под ней (правка 21.09, решение PM): срок,
 * гарантия, часы и услуги показываются сеткой, а не списком строк.
 *
 * Почему сетка, а не строки. Фактов бывает от двух до десяти, и списком
 * они занимали экран целиком, оставляя справа пустую колонку. В сетке
 * глаз охватывает их разом — а именно так по ним и решают, читать ли
 * карточку дальше.
 *
 * Плашки вокруг нет: § Elevation велит сперва проверить, не решается ли
 * группировка расстоянием. Здесь решается — факты стоят сеткой, между
 * группами 48.
 */
function FactGrid({ items }: {
  items: readonly { key: string; icon: React.ReactNode; title: string; note?: string }[]
}) {
  return (
    <ul className="mt-md grid grid-cols-2 gap-x-lg gap-y-xl sm:grid-cols-3">
      {items.map((item) => (
        <li key={item.key}>
          <span className="block text-on-surface-muted">{item.icon}</span>
          <span className="mt-sm block text-body tracking-body tabular-nums">{item.title}</span>
          {item.note !== undefined && item.note !== '' && (
            <span className={`mt-xs block ${hintText}`}>{item.note}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Заголовок раздела — над плашкой, а не внутри неё (чек-лист, п. 1). */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3xl text-subheading tracking-subheading font-medium">{children}</h2>
  )
}

function Works({ photos }: { photos: readonly MasterPhoto[] }) {
  // Разделы в постоянном порядке, а не в порядке загрузки снимков: иначе
  // у двух мастерских одно и то же читается по-разному.
  const groups = PHOTO_ORDER.map((kind) => ({
    kind,
    items: photos.filter((photo) => photo.kind === kind),
  })).filter((group) => group.items.length > 0)

  const [shown, setShown] = useState(0)

  // Один вид работ — вкладок не нужно: единственная вкладка ничего
  // не переключает и читается как заголовок, притворившийся кнопкой.
  const named = groups.length > 1
  const group = groups[Math.min(shown, groups.length - 1)]
  if (group === undefined) return null

  return (
    <>
      {named && (
        <div className="mt-md flex flex-wrap gap-x-lg border-b border-outline">
          {groups.map((item, index) => (
            <button key={item.kind} type="button" onClick={() => setShown(index)}
              aria-current={index === shown} className={tab(index === shown)}>
              {masterCardPage.worksKind[item.kind]}
            </button>
          ))}
        </div>
      )}
      {[group].map((group) => (
        <section key={group.kind} className="mt-lg">
          {/* На телефоне снимок во всю ширину, а не в половину: в группе
              часто один кадр, и рядом с ним оставалась пустая колонка —
              портфолио читалось как обрывки. Две и три колонки появляются
              там, где для них есть ширина. */}
          <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((photo) => (
              <li key={photo.url}>
                {/* Радиус 0: скруглённый угол отрезает предмет и уводит
                    масштаб (§ Shapes). Свои работы (контракт §2). */}
                <img src={photo.url} alt={photo.caption ?? ''}
                  className="aspect-[4/3] w-full bg-surface-container object-cover" />
                {photo.caption !== null && (
                  <p className={`mt-xs ${hintText}`}>{photo.caption}</p>
                )}
                {/* Рисунок отмечается прямо под ним: по рендеру судят
                    о сборке, которой на картинке нет (контракт §2). */}
                {photo.isRender && (
                  <p className={`mt-xs ${hintText}`}>{mastersPage.renderMark}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

export default function MasterProfile() {
  const { id } = useParams()
  /**
   * Идентификатор из адреса — чужой ввод, и проверяется он до вызова, как
   * токен на странице предложений. Ответ на мусор всё равно был бы
   * MASTER_NOT_FOUND, но гонять заведомо негодную строку на сервер незачем.
   */
  const valid = id !== undefined && z.uuid().safeParse(id).success

  // Негодный адрес — не состояние загрузки: сходить всё равно не за чем.
  // Выводится при инициализации, а не в эффекте: иначе первый кадр обещает
  // загрузку, которой не будет.
  const [view, setView] = useState<View>(() => (valid ? { kind: 'loading' } : { kind: 'missing' }))
  /**
   * Окно «готовим безопасную сделку» — единственное окно в продукте
   * (§ Layout, 21.09). Ни формы, ни второго шага: сообщение о том, чего
   * ещё нет, и кнопка «Понятно».
   */
  const [dealShown, setDealShown] = useState(false)
  /** Телефон раскрывается по нажатию, а не лежит открытым (решение PM 21.09). */
  const [phoneShown, setPhoneShown] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!valid || id === undefined) return
    api.getMasterCard(id).then(
      (master) => setView({ kind: 'ready', master }),
      (error: unknown) =>
        setView(
          isApiError(error) && error.code === 'MASTER_NOT_FOUND'
            ? { kind: 'missing' }
            : { kind: 'failed' },
        ),
    )
  }, [id, valid, attempt])

  if (view.kind === 'loading') {
    return (
      <PageShell>
        <p className="text-body tracking-body" role="status">
          {masterCardPage.loading}
        </p>
      </PageShell>
    )
  }

  // Мастерская без опубликованной карточки отвечает так же, как несуществующая:
  // для внешнего мира её здесь просто нет (контракт §5). Человека при этом
  // нельзя оставлять в тупике — отсюда объяснение и выход на форму.
  if (view.kind === 'missing') {
    return (
      <PageShell>
        <h1 className="text-heading tracking-heading font-semibold">{masterCardPage.missingTitle}</h1>
        <p className="mt-lg max-w-measure text-body tracking-body">{masterCardPage.missingBody}</p>
        <Link to="/request" className={`mt-xl inline-flex ${buttonFilled}`}>
          {masterCardPage.toRequest}
        </Link>
        <p className="mt-xl">
          <Link to="/masters" className={link}>
            {masterCardPage.back}
          </Link>
        </p>
      </PageShell>
    )
  }

  if (view.kind === 'failed') {
    return (
      <PageShell>
        <h1 className="text-heading tracking-heading font-semibold">{masterCardPage.failedTitle}</h1>
        <button
          type="button"
          onClick={() => {
            setView({ kind: 'loading' })
            setAttempt((n) => n + 1)
          }}
          className={`mt-xl ${buttonFilled}`}
        >
          {masterCardPage.retry}
        </button>
      </PageShell>
    )
  }

  const { master } = view
  const { card } = master
  const terms = [
    card.leadTime !== null
      ? { icon: <LeadTimeIcon />, title: leadTime(card.leadTime), note: masterCardPage.leadLabel }
      : null,
    card.warrantyMonths !== null
      ? { icon: <WarrantyIcon />, title: warranty(card.warrantyMonths), note: masterCardPage.warrantyLabel }
      : null,
    card.hours !== null
      ? { icon: <HoursIcon />, title: workHours(card.hours), note: masterCardPage.hoursLabel }
      : null,
  ].filter((item) => item !== null)

  /**
   * Панель действий: одно главное действие и строка под ним (§ Components).
   * Одна и та же разметка стоит в боковой колонке на широком экране
   * и в полосе внизу на телефоне — расходиться им нельзя, иначе человек,
   * открывший карточку с ноутбука и с телефона, увидит два разных продукта.
   */
  /**
   * Кто эта мастерская: знак, имя, город со стажем и два факта о работе
   * (правка 21.09, решение PM — по рефам маркетплейсов).
   *
   * Блок собран один раз и показывается в двух местах взаимоисключающе:
   * в боковой колонке на широком экране, в потоке на телефоне, где боковой
   * колонки нет вовсе (`PageShell`, `lg:block`). Две копии разметки вместо
   * одной — цена за то, что колонка живёт в другом месте дерева; разойтись
   * они не могут, потому что собраны из одной переменной.
   */
  const sellerHead = (
    <>
      {/* Знак мастерской, если он есть. Нет — место под него не занимаем:
          ни монограммы, ни серого квадрата (контракт §2). */}
      {card.logo !== null && <img src={card.logo} alt="" className="h-icon-lg w-auto" />}

      {/* Шапка экрана: метка → заголовок (§ Шапка экрана). Метка — город
          и стаж: место мастерской в мире заказчика. */}
      <p className={`mt-lg tabular-nums first:mt-0 ${hintText}`}>
        {cityName(master.city)} · {mastersPage.yearsLabel(card.yearsOnMarket)}
      </p>
      <h1 className="mt-xs max-w-measure-title text-heading tracking-heading font-semibold">
        {master.name}
      </h1>

      {/* Два факта, за которыми заказчик приходит первым делом (21.09):
          договор и свой цех. Шильдиками — § Components описывает шильдик
          как факт, сказанный мастерской о себе. Показываются только
          отмеченные: «не работаем по договору» о себе не заявляют. */}
      {(card.worksByContract || card.ownProduction) && (
        <ul className="mt-sm flex flex-wrap gap-sm">
          {card.worksByContract && <li className={badge}>{masterCardPage.byContractBadge}</li>}
          {card.ownProduction && <li className={badge}>{masterCardPage.ownProductionBadge}</li>}
        </ul>
      )}

      {/* Куда выезжают — сразу под именем: это ответ на «а ко мне поедут?»,
          и половина заказчиков живёт не в центре (бенчмарк 18.09). */}
      {card.serviceArea !== null && (
        <p className={`mt-sm ${hintText}`}>
          {mastersPage.areaLabel}: {card.serviceArea}
        </p>
      )}
    </>
  )

  /**
   * Связь: кнопка раскрывает телефон на месте (правка 21.09, решение PM).
   * Уводить некуда — звонок с телефона начинается с того же номера,
   * а на мониторе его переписывают в трубку.
   */
  const contactBlock = (
    <>
      {card.contactPhone === null ? (
        <p className={`max-w-measure ${hintText}`}>{masterCardPage.contactMissing}</p>
      ) : phoneShown ? (
        <>
          <p className="text-subheading tracking-subheading font-medium tabular-nums">
            {/* Показывается группами, а не сырыми цифрами: «+77010000001»
                человек читает по одной цифре, а номер с карточки переписывают
                в трубку. В `href` уходит то, что в контракте (§2). */}
            <a href={`tel:${card.contactPhone}`} className={link}
              onClick={() => track('contact_made', { from: 'catalogue', masterId: master.id })}>
              {formatPhone(card.contactPhone.replace(/\D/g, '').replace(/^7/, ''))}
            </a>
          </p>
          <div className="-ml-sm mt-xs flex flex-wrap items-center gap-x-sm">
            {card.messengers.includes('whatsapp') && (
              <a href={`https://wa.me/${card.contactPhone.replace(/\D/g, '')}`}
                target="_blank" rel="noreferrer noopener" className={buttonText}
                onClick={() => track('contact_made', { from: 'catalogue', masterId: master.id })}>
                {masterCardPage.actionWrite}
              </a>
            )}
            {card.messengers.includes('telegram') && (
              <a href={`https://t.me/+${card.contactPhone.replace(/\D/g, '')}`}
                target="_blank" rel="noreferrer noopener" className={buttonText}
                onClick={() => track('contact_made', { from: 'catalogue', masterId: master.id })}>
                {masterCardPage.actionWriteTelegram}
              </a>
            )}
          </div>
        </>
      ) : (
        <button type="button" className={`w-full justify-center ${buttonFilled}`}
          onClick={() => setPhoneShown(true)}>
          {masterCardPage.contactShow}
        </button>
      )}
    </>
  )

  /**
   * Два пути дальше, каждый отдельным блоком (решение PM 21.09): расчёт
   * по заявке и будущая безопасная покупка. Иконка с подписью, строка
   * о том, что человек получит, и действие.
   */
  const quoteBlock = (
    <section className={`mt-xl ${panel}`}>
      <span className="block text-on-surface-muted"><QuoteIcon /></span>
      <p className="mt-sm text-body tracking-body font-medium">{masterCardPage.quoteBlockTitle}</p>
      <p className={`mt-xs max-w-measure ${hintText}`}>{masterCardPage.quoteBlockBody}</p>
      <Link to="/request" className={`mt-md w-full justify-center ${buttonFilled}`}>
        {masterCardPage.quoteBlockAction}
      </Link>
    </section>
  )

  const safeBlock = (
      <section className={`mt-lg ${panel}`}>
        <span className="block text-on-surface-muted"><SafeDealIcon /></span>
        <p className="mt-sm text-body tracking-body font-medium">{masterCardPage.safeBlockTitle}</p>
        <p className={`mt-xs max-w-measure ${hintText}`}>{masterCardPage.safeBlockBody}</p>
        <button type="button" className={`-ml-sm mt-md ${buttonText}`}
          onClick={() => setDealShown(true)}>
          {masterCardPage.safeBlockAction}
        </button>
      </section>
  )

  /**
   * Полоса внизу телефона: два пути, ради которых карточку открывают
   * (решение PM 21.09). Безопасная покупка сюда не идёт — она живёт
   * блоком в потоке, и обещать её кнопкой наравне с действующими нельзя.
   */
  const actionPanel = (
    <>
      <Link to="/request" className={`w-full justify-center ${buttonFilled}`}>
        {masterCardPage.quoteBlockAction}
      </Link>
      <div className="mt-sm">{contactBlock}</div>
    </>
  )

  return (
    <PageShell
      layout="item"
      aside={
        <>
          {sellerHead}
          <section className={`mt-xl ${actionBarSide}`} aria-label={masterCardPage.actionsTitle}>
            {contactBlock}
          </section>
          {quoteBlock}
          {safeBlock}
        </>
      }>
      <p className={hintText}>
        <Link to="/masters" className={link}>
          {masterCardPage.back}
        </Link>
      </p>

      {/* Порядок блоков — из бенчмарка мебельных площадок (18.09): работа,
          потом кто и где, потом условия, и только затем рассказ о себе.
          На изученных сайтах первым идёт текст «о компании», одинаковый
          у всех, а фотографии работ — за третьим экраном. */}
      <Gallery photos={card.photos} />

      {/* На телефоне боковой колонки нет, и шапка мастерской живёт здесь;
          на широком экране этот блок скрыт, а тот же самый стоит справа
          над кнопками — как на маркетплейсах, откуда взят порядок. */}
      <div className="mt-lg lg:hidden">{sellerHead}</div>

      {/* Описание — сразу под шапкой (решение PM 21.09, по рефам): человек
          прочитал, кто это, и первым делом хочет понять, чем они занимаются.
          Раньше рассказ стоял предпоследним, после работ и условий. */}
      <SectionTitle>{masterCardPage.aboutLabel}</SectionTitle>
      <p className="mt-md max-w-measure text-body tracking-body">{card.about}</p>

      {/* Направления своими словами (`does`) с карточки сняты 21.09, решение
          PM: чипсами они читались как фильтры, по которым нечего нажать,
          а то же самое человек узнаёт из «Услуг мастерской» и вкладок
          выполненных заказов. В каталоге отбор по ним остаётся — там они
          работают, а не украшают. */}

      {/* Краткие условия сразу за шапкой: по ним человек решает, читать ли
          дальше — срок, гарантия, часы и куда выезжают. */}
      {terms.length > 0 && (
        <>
          <SectionTitle>{masterCardPage.termsLabel}</SectionTitle>
          <FactGrid items={terms.map((item) => ({ key: item.note, ...item }))} />
        </>
      )}

      {/* Работы — до рассказа о себе: их смотрят первыми и по ним решают. */}
      <SectionTitle>{masterCardPage.worksLabel}</SectionTitle>
      <Works photos={card.photos} />

      {/* Что входит в работу. Знак рядом с подписью, а не вместо неё
          (§ Иконки): узнаваемого прототипа здесь нет почти ни у чего.
          Условие — рядом с услугой: два одинаковых списка без него
          несравнимы (контракт §2). */}
      {card.services.length > 0 && (
        <>
          <SectionTitle>{masterCardPage.servicesLabel}</SectionTitle>
          <FactGrid items={card.services.map((service) => {
            const text = serviceText(service.id)
            return {
              key: service.id,
              icon: <ServiceIcon id={service.id} />,
              title: service.paid ? `${text.label} — ${mastersPage.servicePaid}` : text.label,
            }
          })} />
        </>
      )}


      {/* Отзывы. Их в пробе не будет — цикл мебели 3–8 недель, и до первой
          принятой работы проба не доживёт. Раздел стоит пустым по решению
          PM 21.09: место под будущее обозначено, а пустое состояние говорит
          словами, а не прячется (§ Presence). */}
      <SectionTitle>{masterCardPage.reviewsLabel}</SectionTitle>
      <p className="mt-md max-w-measure text-body tracking-body">{masterCardPage.reviewsEmpty}</p>

      {/* На телефоне боковой колонки нет, и будущая покупка стоит здесь,
          под всем рассказом о мастерской. Блока расчёта тут нет намеренно:
          его кнопка уже закреплена внизу экрана, и два одинаковых действия
          человек читает как два разных (чек-лист, п. 3). */}
      <div className="lg:hidden">{safeBlock}</div>

      {/* Место под нижнюю панель: без него последняя строка прячется под
          полосой, и человек не знает, что страница кончилась (§ Layout). */}
      <div aria-hidden="true" className="h-4xl lg:hidden" />

      {/* Та же панель полосой внизу экрана — только на телефоне. */}
      <section className={actionBarFixed} aria-label={masterCardPage.actionsTitle}>
        {actionPanel}
      </section>

      {/* Единственное окно продукта: сообщение о том, чего ещё нет
          (§ Layout, 21.09). Ни формы, ни второго шага; закрывается
          нажатием на «Понятно» и по щелчку мимо. */}
      {dealShown && (
        <SoonDialog title={masterCardPage.dealSoonTitle} onClose={() => setDealShown(false)}>
          <p className="mt-md max-w-measure text-body tracking-body">
            {masterCardPage.dealSoonBody}
          </p>
        </SoonDialog>
      )}
    </PageShell>
  )
}

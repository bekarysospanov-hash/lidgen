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
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { PageShell } from '../../components/PageShell'
import { HoursIcon, LeadTimeIcon, WarrantyIcon } from '../../components/icons'
import { blockRowDivider, buttonFilled, chip, hintText, link, panel } from '../../components/ui'
import type { CategoryId, MasterCardPublic, MasterPhoto } from '../../contract'
import { z } from 'zod'
import { cityName } from '../../questions/categories'
import { serviceText } from '../../questions/services'
import { leadTime, warranty, workHours } from '../../texts/format'
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
 * Строка перечня — иконка, название, под ним подсказка. Тот же строй, что
 * у строки блока в форме (§ Components), но без отметки выбора: выбирать
 * здесь нечего, и точка справа обещала бы действие, которого нет.
 */
function InfoRow({ icon, title, note }: {
  icon: React.ReactNode
  title: string
  note?: string
}) {
  return (
    <div className={blockRowDivider}>
      <div className="flex items-start gap-md px-md py-md">
        <span className="mt-xs text-on-surface-muted">{icon}</span>
        <span className="min-w-0">
          <span className="block text-body tracking-body tabular-nums">{title}</span>
          {note !== undefined && note !== '' && (
            <span className={`mt-xs block ${hintText}`}>{note}</span>
          )}
        </span>
      </div>
    </div>
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

  // Один вид работ — подзаголовок не нужен: он повторил бы заголовок раздела.
  const named = groups.length > 1

  return (
    <>
      {groups.map((group) => (
        <section key={group.kind} className="mt-xl first:mt-lg">
          {named && (
            <p className={hintText}>{masterCardPage.worksKind[group.kind]}</p>
          )}
          {/* На телефоне снимок во всю ширину, а не в половину: в группе
              часто один кадр, и рядом с ним оставалась пустая колонка —
              портфолио читалось как обрывки. Две и три колонки появляются
              там, где для них есть ширина. */}
          <ul className={`grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3 ${named ? 'mt-sm' : ''}`}>
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
  /** Первый снимок — обложка: он открывает экран до имени и текста. */
  const cover = card.photos[0]
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

  return (
    <PageShell>
      <p className={hintText}>
        <Link to="/masters" className={link}>
          {masterCardPage.back}
        </Link>
      </p>

      {/* Порядок блоков — из бенчмарка мебельных площадок (18.09): работа,
          потом кто и где, потом условия, и только затем рассказ о себе.
          На изученных сайтах первым идёт текст «о компании», одинаковый
          у всех, а фотографии работ — за третьим экраном. */}
      {cover !== undefined && (
        <figure className="mt-lg">
          <img src={cover.url} alt={cover.caption ?? ''}
            className="aspect-[3/2] w-full bg-surface-container object-cover" />
          {cover.isRender && (
            <figcaption className={`mt-xs ${hintText}`}>{mastersPage.renderMark}</figcaption>
          )}
        </figure>
      )}

      {/* Знак мастерской, если он есть. Нет — место под него не занимаем:
          ни монограммы, ни серого квадрата (контракт §2). */}
      {card.logo !== null && (
        <img src={card.logo} alt="" className="mt-lg h-icon-lg w-auto" />
      )}

      {/* Шапка экрана: метка → заголовок → лид (§ Шапка экрана). Метка —
          роль, город и стаж: место мастерской в мире заказчика. */}
      <p className={`mt-lg tabular-nums ${hintText}`}>
        {cityName(master.city)} · {mastersPage.yearsLabel(card.yearsOnMarket)}
      </p>
      <h1 className="mt-xs max-w-measure-title text-heading tracking-heading font-semibold">
        {master.name}
      </h1>

      {/* Куда выезжают — сразу под именем: это ответ на «а ко мне поедут?»,
          и половина заказчиков живёт не в центре (бенчмарк 18.09). */}
      {card.serviceArea !== null && (
        <p className={`mt-sm ${hintText}`}>
          {mastersPage.areaLabel}: {card.serviceArea}
        </p>
      )}

      {/* Направления — короткие значения, это ровно случай чипса (§ Components).
          Выбирать здесь нечего, поэтому невыбранное состояние и без обработчика. */}
      <ul className="mt-lg flex flex-wrap gap-sm">
        {card.does.map((item) => (
          <li key={item} className={chip(false)}>
            {item}
          </li>
        ))}
      </ul>

      {/* Краткие условия сразу за шапкой: по ним человек решает, читать ли
          дальше — срок, гарантия, часы и куда выезжают. */}
      {terms.length > 0 && (
        <>
          <SectionTitle>{masterCardPage.termsLabel}</SectionTitle>
          <div className={`mt-md ${panel}`}>
            <div className="-mx-md">
              {terms.map((item) => (
                <InfoRow key={item.note} icon={item.icon} title={item.title} note={item.note} />
              ))}
            </div>
          </div>
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
          <div className={`mt-md ${panel}`}>
            <div className="-mx-md">
              {card.services.map((service) => {
                const text = serviceText(service.id)
                return (
                  <InfoRow key={service.id} icon={<ServiceIcon id={service.id} />}
                    title={service.paid ? `${text.label} — ${mastersPage.servicePaid}` : text.label}
                    note={text.hint} />
                )
              })}
            </div>
          </div>
          {/* Оговорка стоит сразу под перечнем, а не в конце экрана: тот же
              замер человек увидит второй раз в предложении, и узнать, какой
              ответ главнее, он должен здесь, а не когда заметит расхождение. */}
          <p className={`mt-sm max-w-measure ${hintText}`}>{masterCardPage.servicesNote}</p>
        </>
      )}

      {/* Отличия своими словами. После общего перечня: сначала то, что
          сравнимо между мастерскими, потом то, что есть только у этой. */}
      {card.extras.length > 0 && (
        <>
          <SectionTitle>{masterCardPage.extrasLabel}</SectionTitle>
          <ul className="mt-md max-w-measure">
            {card.extras.map((item) => (
              <li key={item} className="mt-sm text-body tracking-body first:mt-0">
                {item}
              </li>
            ))}
          </ul>
        </>
      )}

      <SectionTitle>{masterCardPage.aboutLabel}</SectionTitle>
      <p className="mt-md max-w-measure text-body tracking-body">{card.about}</p>

      {/* Главное действие в конце экрана (§ Порядок важнее полноты). Обе
          строки — перед кнопкой, а не после: предупреждение, прочитанное
          после нажатия, уже не предупреждение. */}
      <p className={`mt-3xl max-w-measure ${hintText}`}>{masterCardPage.contactNote}</p>
      <p className={`mt-sm max-w-measure ${hintText}`}>{masterCardPage.fanNote}</p>
      <Link to="/request" className={`mt-lg inline-flex ${buttonFilled}`}>
        {masterCardPage.toRequest}
      </Link>
    </PageShell>
  )
}

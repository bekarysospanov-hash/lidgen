// US-03 — карточка одной мастерской. Раскрывает то, что в каталоге показано
// кратко: полный рассказ, все направления, все работы.
//
// Телефона здесь нет и не будет. Контакт приходит вместе с предложением
// (US-24, контракт §2): мастерская отвечает конкретной заказчице и знает,
// что по её ответу позвонят. Раздавать телефоны в каталоге — значит уводить
// сделку мимо продукта и терять единственную метрику, которая у пробы есть.
//
// Заявка из карточки всё равно веерная (PRD US-03): кнопка ведёт на общую
// форму, и строка под ней говорит об этом прямо — узнать такое на дозвоне
// хуже, чем прочитать на экране.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { PageShell } from '../../components/PageShell'
import { buttonFilled, chip, hintText, link } from '../../components/ui'
import type { MasterCardPublic } from '../../contract'
import { z } from 'zod'
import { cityName } from '../../questions/categories'
import { masterCardPage, mastersPage } from '../../texts/masters'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; master: MasterCardPublic }
  | { kind: 'missing' }
  | { kind: 'failed' }

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

  return (
    <PageShell>
      <p className={hintText}>
        <Link to="/masters" className={link}>
          {masterCardPage.back}
        </Link>
      </p>

      {/* Шапка экрана: метка → заголовок → лид (§ Шапка экрана). Метка здесь —
          город и стаж: место мастерской в мире заказчицы, а не украшение. */}
      <p className={`mt-lg ${hintText}`}>
        {cityName(master.city)} · {mastersPage.yearsLabel(master.card.yearsOnMarket)}
      </p>
      <h1 className="mt-xs max-w-measure-title text-heading tracking-heading font-semibold">
        {master.name}
      </h1>

      <p className={`mt-3xl ${hintText}`}>{masterCardPage.aboutLabel}</p>
      <p className="mt-sm max-w-measure text-body tracking-body">{master.card.about}</p>

      {/* Направления — короткие значения, это ровно случай чипса (§ Components).
          Выбирать здесь нечего, поэтому невыбранное состояние и без обработчика. */}
      <p className={`mt-xl ${hintText}`}>{mastersPage.doesLabel}</p>
      <ul className="mt-sm flex flex-wrap gap-sm">
        {master.card.does.map((item) => (
          <li key={item} className={chip(false)}>
            {item}
          </li>
        ))}
      </ul>

      {/* Снимки — радиус 0: скруглённый угол отрезает предмет и уводит масштаб
          (§ Shapes). Свои работы, снятые у своих заказчиков (контракт §2). */}
      <p className={`mt-xl ${hintText}`}>{masterCardPage.worksLabel}</p>
      <ul className="mt-sm grid grid-cols-2 gap-md sm:grid-cols-3">
        {master.card.photos.map((photo) => (
          <li key={photo}>
            <img src={photo} alt="" className="aspect-[4/3] w-full object-cover" />
          </li>
        ))}
      </ul>

      {/* Главное действие в конце экрана (§ Порядок важнее полноты), а строка
          про веер — перед кнопкой, а не после: предупреждение, прочитанное
          после нажатия, уже не предупреждение. */}
      <p className={`mt-3xl max-w-measure ${hintText}`}>{masterCardPage.fanNote}</p>
      <Link to="/request" className={`mt-sm inline-flex ${buttonFilled}`}>
        {masterCardPage.toRequest}
      </Link>
    </PageShell>
  )
}

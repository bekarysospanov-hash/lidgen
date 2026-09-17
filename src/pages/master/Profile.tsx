// US-20 — своя карточка. Кабинет позволял отвечать на заявки, но не показывал
// мебельщику его самого: что о нём написано в каталоге и можно ли это поправить.
//
// Что правится, а что нет (контракт §5б). Название и город меняем мы: город
// определяет, какие заявки ему придут, и самостоятельная смена означала бы,
// что маршрутизация зависит от настроения получателя. Телефон — вход в кабинет.
// Фотографии собираем и проверяем мы (трек A2): загрузка отсюда потребовала бы
// модерации, которой в пробе нет, а без неё первое же чужое фото ломает
// обещание «мы отобрали и проверили».
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../../api/client'
import { isApiError } from '../../api/errors'
import { MasterShell } from '../../components/MasterShell'
import {
  buttonFilled,
  chip,
  errorTextClass,
  field,
  fieldLabel,
  hintText,
  panel,
  panelNested,
} from '../../components/ui'
import type { MasterSession, MyCard } from '../../contract'
import { cityName } from '../../questions/categories'
import { errorText } from '../../texts/request'
import { profilePage } from '../../texts/master'
import { readSession } from './session'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; card: MyCard }
  | { kind: 'failed'; message: string }

interface Draft {
  about: string
  years: string
  /** Направления одной строкой через запятую: их до шести, и это не список форм. */
  does: string
}

export default function MasterProfileEdit() {
  const [session] = useState<MasterSession | null>(() => readSession())
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [draft, setDraft] = useState<Draft>({ about: '', years: '', does: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (session === null) return
    api.getMyCard(session.token).then(
      (card) => {
        setView({ kind: 'ready', card })
        if (card.card !== null) {
          setDraft({
            about: card.card.about,
            years: String(card.card.yearsOnMarket),
            does: card.card.does.join(', '),
          })
        }
      },
      (error: unknown) =>
        setView({
          kind: 'failed',
          message: isApiError(error) ? errorText[error.code] : profilePage.failedTitle,
        }),
    )
  }, [session, attempt])

  if (session === null) return <Navigate to="/master" replace />

  if (view.kind === 'loading') {
    return (
      <MasterShell masterName={session.master.name}>
        <p className="text-body tracking-body" role="status">
          {profilePage.loading}
        </p>
      </MasterShell>
    )
  }

  if (view.kind === 'failed') {
    return (
      <MasterShell masterName={session.master.name}>
        <h1 className="text-heading tracking-heading font-semibold">{profilePage.failedTitle}</h1>
        <p className="mt-lg max-w-measure text-body tracking-body">{view.message}</p>
        <button
          type="button"
          className={`mt-xl ${buttonFilled}`}
          onClick={() => {
            setView({ kind: 'loading' })
            setAttempt((n) => n + 1)
          }}
        >
          {profilePage.retry}
        </button>
      </MasterShell>
    )
  }

  const { card } = view

  /** Направления из строки: пустые куски отбрасываются, порядок сохраняется. */
  function parseDoes(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '')
  }

  function validate(): boolean {
    const found: Partial<Record<keyof Draft, string>> = {}
    if (draft.about.trim() === '') found.about = profilePage.errorAboutEmpty
    const does = parseDoes(draft.does)
    if (does.length === 0) found.does = profilePage.errorDoesEmpty
    else if (does.length > 6) found.does = profilePage.errorDoesMany
    const years = Number(draft.years)
    if (draft.years.trim() === '' || !Number.isInteger(years) || years < 0) {
      found.years = profilePage.errorYears
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  function save() {
    if (!validate() || session === null) return
    setSaving(true)
    setSaved(false)
    setSendError(null)
    api
      .updateMyCard(session.token, {
        about: draft.about.trim(),
        yearsOnMarket: Number(draft.years),
        does: parseDoes(draft.does),
      })
      .then(
        (updated) => {
          setSaving(false)
          setSaved(true)
          setView({ kind: 'ready', card: updated })
        },
        (error: unknown) => {
          setSaving(false)
          setSendError(isApiError(error) ? errorText[error.code] : errorText.NETWORK)
        },
      )
  }

  return (
    <MasterShell masterName={session.master.name}>
      <p className={hintText}>{profilePage.label}</p>
      <h1 className="mt-xs max-w-measure-title text-heading tracking-heading font-semibold">
        {profilePage.title}
      </h1>
      <p className="mt-lg max-w-measure text-body tracking-body">{profilePage.lede}</p>

      {/* Что заведено нами и не правится отсюда. Стоит первым, чтобы вопрос
          «а где поменять город» не возникал посреди формы. */}
      <div className={`mt-3xl ${panel}`}>
        <p className={fieldLabel}>{profilePage.nameLabel}</p>
        <p className="mt-xs text-body tracking-body">{card.name}</p>
        <p className={`mt-lg ${fieldLabel}`}>{profilePage.cityLabel}</p>
        <p className="mt-xs text-body tracking-body">{cityName(card.city)}</p>
        <p className={`mt-lg max-w-measure ${hintText}`}>{profilePage.fixedNote}</p>
      </div>

      {card.card === null ? (
        // Карточки ещё нет — законное состояние, а не ошибка: приём заявок
        // и публикация в каталоге разные решения (контракт §2). Форму
        // не показываем вовсе: править нечего, и пустая форма обещала бы,
        // что публикация зависит от него.
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{profilePage.emptyTitle}</h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{profilePage.emptyBody}</p>
        </section>
      ) : (
        <section className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{profilePage.aboutLabel}</h2>

          <div className={`mt-lg ${panel}`}>
            <label className="block" htmlFor="about">
              <span className={fieldLabel}>{profilePage.aboutLabel}</span>
              <textarea
                id="about"
                rows={4}
                value={draft.about}
                onChange={(event) => setDraft((current) => ({ ...current, about: event.target.value }))}
                placeholder={profilePage.aboutPlaceholder}
                aria-invalid={errors.about !== undefined}
                className={`mt-sm block w-full ${field(errors.about !== undefined)}`}
              />
            </label>
            {errors.about ? (
              <p className={`mt-xs ${errorTextClass}`}>{errors.about}</p>
            ) : (
              <p className={`mt-xs max-w-measure ${hintText}`}>{profilePage.aboutHint}</p>
            )}

            <label className="mt-xl block" htmlFor="years">
              <span className={fieldLabel}>{profilePage.yearsLabel}</span>
              <input
                id="years"
                inputMode="numeric"
                value={draft.years}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, years: event.target.value.replace(/\D/g, '').slice(0, 2) }))
                }
                aria-invalid={errors.years !== undefined}
                className={`mt-sm block w-[10rem] ${field(errors.years !== undefined)}`}
              />
            </label>
            {errors.years && <p className={`mt-xs ${errorTextClass}`}>{errors.years}</p>}

            <label className="mt-xl block" htmlFor="does">
              <span className={fieldLabel}>{profilePage.doesLabel}</span>
              <input
                id="does"
                value={draft.does}
                onChange={(event) => setDraft((current) => ({ ...current, does: event.target.value }))}
                placeholder={profilePage.doesPlaceholder}
                aria-invalid={errors.does !== undefined}
                className={`mt-sm block w-full ${field(errors.does !== undefined)}`}
              />
            </label>
            {errors.does ? (
              <p className={`mt-xs ${errorTextClass}`}>{errors.does}</p>
            ) : (
              <p className={`mt-xs max-w-measure ${hintText}`}>{profilePage.doesHint}</p>
            )}

            {/* Как это прочтётся в каталоге — тем же чипсом, каким показано там.
                Второй уровень поверхности: вложенная плашка внутри формы. */}
            {parseDoes(draft.does).length > 0 && (
              <div className={`mt-lg ${panelNested}`}>
                <ul className="flex flex-wrap gap-sm">
                  {parseDoes(draft.does).map((item) => (
                    <li key={item} className={chip(false)}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Фотографии показываем, но не трогаем: их проверяем мы, и запрет
              на чужие работы держится именно на этом (контракт §5б). */}
          <h2 className="mt-3xl text-subheading tracking-subheading font-medium">
            {profilePage.worksLabel}
          </h2>
          <ul className="mt-lg grid grid-cols-2 gap-md sm:grid-cols-3">
            {card.card.photos.map((photo) => (
              <li key={photo}>
                <img src={photo} alt="" className="aspect-[4/3] w-full object-cover" />
              </li>
            ))}
          </ul>
          <p className={`mt-sm max-w-measure ${hintText}`}>{profilePage.worksNote}</p>

          {sendError !== null && <p className={`mt-xl ${errorTextClass}`}>{sendError}</p>}
          {saved && <p className={`mt-xl ${hintText}`}>{profilePage.saved}</p>}

          <button type="button" onClick={save} disabled={saving} className={`mt-xl ${buttonFilled}`}>
            {saving ? profilePage.saving : profilePage.save}
          </button>
        </section>
      )}
    </MasterShell>
  )
}

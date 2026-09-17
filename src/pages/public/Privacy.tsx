// US-11 — политика обработки персональных данных. Отдельная страница, а не
// раскрывающийся блок под формой: сценарий PRD требует, чтобы её можно было
// открыть, не потеряв заполненное, — значит она живёт по своему адресу
// и открывается отдельной вкладкой.
//
// Плашек здесь нет: абзацы самостоятельны, а плашка вокруг самостоятельного
// элемента — шум (DESIGN.md § Elevation).
import { PageShell } from '../../components/PageShell'
import { hintText } from '../../components/ui'
import { POLICY_VERSION, privacyPage } from '../../texts/privacy'

export default function Privacy() {
  return (
    <PageShell>
      <h1 className="max-w-measure-title text-heading tracking-heading font-semibold">
        {privacyPage.title}
      </h1>
      <p className={`mt-sm ${hintText}`}>{privacyPage.version(POLICY_VERSION)}</p>

      {/* PROBE: текст не прошёл юридическую проверку, пропуски не заполнены.
          Предупреждение видно человеку, а не только в комментарии кода:
          документ, выданный за готовый, хуже отсутствующего. Снимается
          вместе с настоящим текстом от юриста. */}
      <p className="mt-lg max-w-measure text-body tracking-body text-error">
        {privacyPage.draftWarning}
      </p>

      {privacyPage.sections.map((section) => (
        <section key={section.title} className="mt-3xl">
          <h2 className="text-subheading tracking-subheading font-medium">{section.title}</h2>
          <p className="mt-sm max-w-measure text-body tracking-body">{section.body}</p>
        </section>
      ))}
    </PageShell>
  )
}

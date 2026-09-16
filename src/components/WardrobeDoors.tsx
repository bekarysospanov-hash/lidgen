// US-06 — типы дверей шкафа, нарисованные вручную. Вид спереди, в отличие
// от планировок кухни: шкаф узнают по фасаду, а не по плану комнаты, и
// смешивать две перспективы в одном наборе нельзя — набор рассыпается
// (DESIGN.md § Иконки).
//
// Корпус светлый контуром, створки закрашены акцентом — та же грамматика,
// что у KitchenShape: «вот мебель, вот её главная черта».

export function WardrobeDoors({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" className="h-12 w-16 shrink-0">
      {/* Корпус — общий для всех трёх, чтобы отличие читалось сразу. */}
      <path d="M8 2 h48 v44 h-48 Z" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />

      {id === 'swing' && (
        <>
          <rect x="10" y="4" width="21" height="40" fill="currentColor" />
          <rect x="33" y="4" width="21" height="40" fill="currentColor" />
          {/* Ручки у стыка — по ним распашные и узнают. Цвет холста токеном,
              а не литералом: чертёж живёт по тем же правилам, что интерфейс. */}
          <rect x="28" y="22" width="2" height="6" fill="var(--color-surface)" />
          <rect x="34" y="22" width="2" height="6" fill="var(--color-surface)" />
        </>
      )}

      {id === 'sliding' && (
        <>
          {/* Створки внахлёст и направляющая снизу: купе читается по тому,
              что одна панель заезжает за другую. */}
          <rect x="10" y="4" width="24" height="40" fill="currentColor" opacity="0.55" />
          <rect x="28" y="4" width="24" height="40" fill="currentColor" />
          <path d="M10 45 h44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}

      {id === 'none' && (
        <>
          {/* Полки вместо фасада — внутренность видна, дверей нет. */}
          <path d="M10 14 h44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 26 h44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 38 h44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

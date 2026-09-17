// Tier B — схемы планировок, нарисованные вручную. Не иконки из библиотеки
// и не стоковые картинки: план комнаты сверху, мебель закрашена акцентом.
// Правило US-05b: форму кухни выбирают глазами, а не по слову.

const room = 'M2 2 h60 v44 h-60 Z'

export function KitchenShape({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" className="h-shape-h w-shape-w shrink-0">
      <path d={room} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      {id === 'straight' && <rect x="6" y="6" width="52" height="8" fill="currentColor" />}
      {id === 'corner' && (
        <>
          <rect x="6" y="6" width="52" height="8" fill="currentColor" />
          <rect x="6" y="14" width="8" height="28" fill="currentColor" />
        </>
      )}
      {id === 'u-shape' && (
        <>
          <rect x="6" y="6" width="52" height="8" fill="currentColor" />
          <rect x="6" y="14" width="8" height="28" fill="currentColor" />
          <rect x="50" y="14" width="8" height="28" fill="currentColor" />
        </>
      )}
      {id === 'island' && (
        <>
          <rect x="6" y="6" width="52" height="8" fill="currentColor" />
          <rect x="6" y="14" width="8" height="28" fill="currentColor" />
          <rect x="26" y="26" width="24" height="10" rx="1" fill="currentColor" />
        </>
      )}
    </svg>
  )
}

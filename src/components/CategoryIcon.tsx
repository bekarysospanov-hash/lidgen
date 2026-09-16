// Иконки категорий — единственное место системы, где иконка несёт содержание,
// а не украшает (DESIGN.md § Иконки). Рисуются вручную, одной толщиной 1.5,
// скруглёнными концами, в одной фронтальной перспективе — как и KitchenShape,
// который рисует планировки сверху и потому живёт отдельно.
//
// Генерации изображений в проекте нет и сборных наборов мы не берём: набор из
// разных источников разъезжается по толщине и перспективе с первой же иконки.

/** Категории из src/questions/categories.ts — четыре, пятой не бывает. */
type IconId = 'kitchen' | 'wardrobe' | 'bathroom' | 'other'

export function CategoryIcon({ id }: { id: IconId }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      {/* Кухня: верхний ряд шкафов и нижние тумбы, между ними фартук. */}
      {id === 'kitchen' && (
        <>
          <path d="M3 3h18v6H3z" />
          <path d="M12 3v6" />
          <path d="M3 13h18v8H3z" />
          <path d="M12 13v8" />
        </>
      )}
      {/* Шкаф: две распашные дверцы, ручки у стыка. */}
      {id === 'wardrobe' && (
        <>
          <path d="M4 3h16v18H4z" />
          <path d="M12 3v18" />
          <path d="M10.5 11v2" />
          <path d="M13.5 11v2" />
        </>
      )}
      {/* Ванная: зеркало над тумбой под раковину. */}
      {id === 'bathroom' && (
        <>
          <path d="M8 2h8v6H8z" />
          <path d="M4 11h16v10H4z" />
          <path d="M12 11v10" />
        </>
      )}
      {/* Другое: комод — то, что перечислено в подсказке категории. */}
      {id === 'other' && (
        <>
          <path d="M4 5h16v14H4z" />
          <path d="M4 9.7h16" />
          <path d="M4 14.3h16" />
          <path d="M10.5 7.3h3" />
          <path d="M10.5 12h3" />
          <path d="M10.5 16.6h3" />
        </>
      )}
    </svg>
  )
}

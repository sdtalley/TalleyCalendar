'use client'

export function MealsTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-dim)' }}>
      <span style={{ fontSize: 48 }}>🍽</span>
      <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Meals &amp; Recipes</div>
      <div className="text-sm">Meal planner with recipes — coming in Phase 3C</div>
    </div>
  )
}

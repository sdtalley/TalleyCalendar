'use client'

import { useState, useEffect, useCallback } from 'react'
import { InfoBar } from '@/components/layout/InfoBar'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import type { DayMeals, MealCategory, MealEntry, Recipe } from '@/lib/calendar/types'

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack']

const CAT_LABELS: Record<MealCategory, string> = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  snack:     'Snack',
}

const CAT_COLORS: Record<MealCategory, string> = {
  breakfast: '#3b82f6',
  lunch:     '#22c55e',
  dinner:    '#f59e0b',
  snack:     '#a855f7',
}

const CAT_EMOJIS: Record<MealCategory, string> = {
  breakfast: '🌅',
  lunch:     '☀️',
  dinner:    '🍽️',
  snack:     '🍎',
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function weekStartFor(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - s.getDay())
  return s
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatWeekLabel(start: Date): string {
  const end = addDays(start, 6)
  const sm = start.toLocaleDateString('en-US', { month: 'short' })
  const em = end.toLocaleDateString('en-US', { month: 'short' })
  const sd = start.getDate()
  const ed = end.getDate()
  return sm === em ? `${sm} ${sd}–${ed}` : `${sm} ${sd} – ${em} ${ed}`
}

function catColor(cat: string): string {
  return CAT_COLORS[cat as MealCategory] ?? 'var(--accent)'
}
function catLabel(cat: string): string {
  return CAT_LABELS[cat as MealCategory] ?? cat
}
function catEmoji(cat: string): string {
  return CAT_EMOJIS[cat as MealCategory] ?? '🍴'
}

// ── Meal Entry Modal ─────────────────────────────────────────────────────────

interface ModalState {
  date: string
  category: MealCategory
  entry: MealEntry | null
}

function MealModal({
  state,
  onClose,
  onSave,
  onDelete,
}: {
  state: ModalState
  onClose: () => void
  onSave: (date: string, category: MealCategory, entry: MealEntry) => void
  onDelete: (date: string, category: MealCategory, entryId: string) => void
}) {
  const [name, setName] = useState(state.entry?.name ?? '')
  const [note, setNote] = useState(state.entry?.note ?? '')
  const [repeatEnabled, setRepeatEnabled] = useState(!!state.entry?.repeat)
  const [repeatDays, setRepeatDays] = useState<number[]>(state.entry?.repeat?.daysOfWeek ?? [])

  const isEditing = !!state.entry

  function toggleDay(d: number) {
    setRepeatDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function handleSave() {
    if (!name.trim()) return
    const entry: MealEntry = {
      id: state.entry?.id ?? `${Date.now()}`,
      name: name.trim(),
      note: note.trim() || undefined,
      repeat: repeatEnabled && repeatDays.length > 0
        ? { frequency: 'weekly', daysOfWeek: repeatDays }
        : undefined,
    }
    onSave(state.date, state.category, entry)
  }

  const color = CAT_COLORS[state.category]
  const label = CAT_LABELS[state.category]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl p-5 flex flex-col gap-4"
        style={{ background: 'var(--surface2)', width: 360, maxWidth: '90vw' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>{CAT_EMOJIS[state.category]}</span>
          <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>
            {isEditing ? `Edit ${label}` : `Add ${label}`}
          </span>
        </div>

        <input
          autoFocus
          placeholder={`${label} name`}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: 'var(--surface)', border: `2px solid ${color}`, color: 'var(--text)' }}
        />

        <input
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={repeatEnabled} onChange={e => setRepeatEnabled(e.target.checked)} />
            <span className="text-sm" style={{ color: 'var(--text)' }}>Repeat weekly</span>
          </label>
          {repeatEnabled && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {DOW.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className="rounded-full text-xs font-semibold px-2.5 py-1 border transition-colors"
                  style={{
                    background:  repeatDays.includes(i) ? color : 'transparent',
                    color:       repeatDays.includes(i) ? '#fff' : 'var(--text-dim)',
                    borderColor: repeatDays.includes(i) ? color : 'var(--border)',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          {isEditing && (
            <button
              onClick={() => onDelete(state.date, state.category, state.entry!.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-1.5 rounded-lg text-sm font-bold"
            style={{ background: color, color: '#fff', opacity: name.trim() ? 1 : 0.4 }}
          >
            {isEditing ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Plan Meal Modal ──────────────────────────────────────────────────────────

function PlanMealModal({
  recipe,
  onClose,
  onPlan,
}: {
  recipe: Recipe
  onClose: () => void
  onPlan: (date: string, category: MealCategory) => void
}) {
  const [date, setDate] = useState(() => toDateKey(new Date()))
  const defaultCat: MealCategory =
    (CATEGORIES as string[]).includes(recipe.category) ? (recipe.category as MealCategory) : 'dinner'
  const [category, setCategory] = useState<MealCategory>(defaultCat)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl p-5 flex flex-col gap-4"
        style={{ background: 'var(--surface2)', width: 320, maxWidth: '90vw' }}
      >
        <div className="font-bold text-base" style={{ color: 'var(--text)' }}>
          Plan "{recipe.name}"
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-dim)' }}>Date</div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-dim)' }}>Meal</div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="rounded-full px-3 py-1 text-xs font-semibold border transition-colors"
                style={{
                  background:  category === cat ? CAT_COLORS[cat] : 'transparent',
                  color:       category === cat ? '#fff' : 'var(--text-dim)',
                  borderColor: category === cat ? CAT_COLORS[cat] : 'var(--border)',
                }}
              >
                {CAT_EMOJIS[cat]} {CAT_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onPlan(date, category)}
            disabled={!date}
            className="px-4 py-1.5 rounded-lg text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#fff', opacity: date ? 1 : 0.4 }}
          >
            Add to Planner
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Recipe Form ──────────────────────────────────────────────────────────────

function RecipeForm({
  recipe,
  onClose,
  onSave,
}: {
  recipe: Recipe | null
  onClose: () => void
  onSave: (recipe: Recipe) => void
}) {
  const [name,         setName]         = useState(recipe?.name ?? '')
  const [category,     setCategory]     = useState<string>(recipe?.category ?? 'dinner')
  const [ingredients,  setIngredients]  = useState((recipe?.ingredients ?? []).join('\n'))
  const [instructions, setInstructions] = useState(recipe?.instructions ?? '')
  const [sourceUrl,    setSourceUrl]    = useState(recipe?.sourceUrl ?? '')
  const [importUrl,    setImportUrl]    = useState('')
  const [importing,    setImporting]    = useState(false)
  const [importError,  setImportError]  = useState('')

  async function handleImport() {
    if (!importUrl.trim()) return
    setImporting(true)
    setImportError('')
    try {
      const res = await fetch('/api/recipes/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error ?? 'Import failed'); return }
      if (data.name)                   setName(data.name)
      if (data.category)               setCategory(data.category)
      if (data.ingredients?.length)    setIngredients(data.ingredients.join('\n'))
      if (data.instructions)           setInstructions(data.instructions)
      setSourceUrl(importUrl.trim())
    } catch {
      setImportError('Failed to reach the server')
    } finally {
      setImporting(false)
    }
  }

  function handleSave() {
    if (!name.trim()) return
    const now = new Date().toISOString()
    const r: Recipe = {
      id:           recipe?.id ?? crypto.randomUUID(),
      name:         name.trim(),
      category,
      ingredients:  ingredients.split('\n').map(l => l.trim()).filter(Boolean),
      instructions: instructions.trim(),
      sourceUrl:    sourceUrl.trim() || undefined,
      createdAt:    recipe?.createdAt ?? now,
      updatedAt:    now,
    }
    onSave(r)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl p-5 flex flex-col gap-4 overflow-y-auto"
        style={{ background: 'var(--surface2)', width: 460, maxWidth: '95vw', maxHeight: '90vh' }}
      >
        <div className="font-bold text-lg" style={{ color: 'var(--text)' }}>
          {recipe ? 'Edit Recipe' : 'New Recipe'}
        </div>

        {/* URL import */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-dim)' }}>
            Import from URL
          </div>
          <div className="flex gap-2">
            <input
              placeholder="Paste recipe URL…"
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleImport() }}
              className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <button
              onClick={handleImport}
              disabled={importing || !importUrl.trim()}
              className="px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#fff', opacity: importing || !importUrl.trim() ? 0.5 : 1 }}
            >
              {importing ? '…' : 'Import'}
            </button>
          </div>
          {importError && (
            <div className="text-xs mt-1" style={{ color: '#ef4444' }}>{importError}</div>
          )}
        </div>

        {/* Name */}
        <input
          autoFocus
          placeholder="Recipe name *"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none font-semibold"
          style={{ background: 'var(--surface)', border: '2px solid var(--accent)', color: 'var(--text)' }}
        />

        {/* Category */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-dim)' }}>Category</div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="rounded-full px-3 py-1 text-xs font-semibold border transition-colors"
                style={{
                  background:  category === cat ? CAT_COLORS[cat] : 'transparent',
                  color:       category === cat ? '#fff' : 'var(--text-dim)',
                  borderColor: category === cat ? CAT_COLORS[cat] : 'var(--border)',
                }}
              >
                {CAT_EMOJIS[cat]} {CAT_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-dim)' }}>
            Ingredients <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(one per line)</span>
          </div>
          <textarea
            placeholder={'2 cups flour\n1 tsp salt\n…'}
            value={ingredients}
            onChange={e => setIngredients(e.target.value)}
            rows={6}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
          />
        </div>

        {/* Instructions */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-dim)' }}>Instructions</div>
          <textarea
            placeholder="Describe the steps…"
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            rows={6}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-y"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit' }}
          />
        </div>

        {/* Source URL */}
        <input
          placeholder="Source URL (optional)"
          value={sourceUrl}
          onChange={e => setSourceUrl(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-1.5 rounded-lg text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#fff', opacity: name.trim() ? 1 : 0.4 }}
          >
            {recipe ? 'Save' : 'Add Recipe'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Recipe Detail ────────────────────────────────────────────────────────────

function RecipeDetail({
  recipe,
  onEdit,
  onDelete,
  onPlanMeal,
  onAddToGrocery,
  groceryStatus,
}: {
  recipe: Recipe
  onEdit: () => void
  onDelete: () => void
  onPlanMeal: () => void
  onAddToGrocery: () => void
  groceryStatus: string | null
}) {
  const color = catColor(recipe.category)
  const label = catLabel(recipe.category)
  const emoji = catEmoji(recipe.category)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 py-3 flex items-start justify-between gap-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="min-w-0">
          <div className="font-bold text-xl leading-tight truncate" style={{ color: 'var(--text)' }}>
            {recipe.name}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${color}22`, color }}
            >
              {emoji} {label}
            </span>
            {recipe.sourceUrl && (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline"
                style={{ color: 'var(--text-dim)' }}
              >
                🔗 Source
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="px-2.5 py-1 rounded text-xs font-semibold"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-2.5 py-1 rounded text-xs font-semibold"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={onPlanMeal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            📅 Plan Meal
          </button>
          <button
            onClick={onAddToGrocery}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold"
            style={{
              background: 'rgba(34,197,94,0.15)',
              color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            🛒 Add to Grocery List
          </button>
          {groceryStatus && (
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{groceryStatus}</span>
          )}
        </div>

        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--text-dim)' }}
            >
              Ingredients ({recipe.ingredients.length})
            </div>
            <ul className="flex flex-col gap-1.5">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text)' }}>
                  <span style={{ color, flexShrink: 0, marginTop: 1 }}>•</span>
                  {ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {recipe.instructions && (
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--text-dim)' }}
            >
              Instructions
            </div>
            <div className="flex flex-col gap-3">
              {recipe.instructions.split('\n').filter(Boolean).map((para, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        )}

        {recipe.ingredients.length === 0 && !recipe.instructions && (
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            No details added yet. Click Edit to fill in ingredients and instructions.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Recipes View ─────────────────────────────────────────────────────────────

function RecipesView({
  recipes,
  onAddNew,
}: {
  recipes: Recipe[]
  onAddNew: () => void
}) {
  const [catFilter,      setCatFilter]      = useState<string | null>(null)
  const [selectedId,     setSelectedId]     = useState<string | null>(null)
  const [editingRecipe,  setEditingRecipe]  = useState<Recipe | null>(null)
  const [showForm,       setShowForm]       = useState(false)
  const [planningRecipe, setPlanningRecipe] = useState<Recipe | null>(null)
  const [groceryStatus,  setGroceryStatus]  = useState<string | null>(null)
  const [localRecipes,   setLocalRecipes]   = useState<Recipe[]>(recipes)
  const [mobileView,     setMobileView]     = useState<'list' | 'detail'>('list')

  // Keep local state in sync when parent re-loads
  useEffect(() => { setLocalRecipes(recipes) }, [recipes])

  const filtered = catFilter
    ? localRecipes.filter(r => r.category === catFilter)
    : localRecipes

  const selected = localRecipes.find(r => r.id === selectedId) ?? null

  // Grocery status auto-clears after 4 seconds
  useEffect(() => {
    if (!groceryStatus) return
    const t = setTimeout(() => setGroceryStatus(null), 4000)
    return () => clearTimeout(t)
  }, [groceryStatus])

  async function handleSaveRecipe(recipe: Recipe) {
    setShowForm(false)
    setEditingRecipe(null)
    const isNew = !localRecipes.find(r => r.id === recipe.id)
    const method = isNew ? 'POST' : 'PATCH'
    const url = isNew ? '/api/recipes' : `/api/recipes/${recipe.id}`
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    })
    if (!res.ok) return
    const saved = await res.json()
    setLocalRecipes(prev =>
      isNew ? [...prev, saved] : prev.map(r => r.id === saved.id ? saved : r)
    )
    setSelectedId(saved.id)
    setMobileView('detail')
  }

  async function handleDeleteRecipe(id: string) {
    if (!confirm('Delete this recipe?')) return
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' })
    setLocalRecipes(prev => prev.filter(r => r.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
      setMobileView('list')
    }
  }

  async function handlePlanMeal(date: string, category: MealCategory) {
    if (!planningRecipe) return
    setPlanningRecipe(null)
    const entry: MealEntry = {
      id:       crypto.randomUUID(),
      name:     planningRecipe.name,
      recipeId: planningRecipe.id,
    }
    await fetch(`/api/meals/${date}/${category}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
  }

  async function handleAddToGrocery() {
    if (!selected) return
    setGroceryStatus('Adding…')
    const listsRes = await fetch('/api/lists')
    if (!listsRes.ok) { setGroceryStatus('Could not load lists'); return }
    const lists = await listsRes.json()
    const groceryList = lists.find((l: { isGroceryDefault?: boolean }) => l.isGroceryDefault)
    if (!groceryList) {
      setGroceryStatus('No default grocery list — set one in the Lists tab')
      return
    }
    const items = selected.ingredients.map(text => ({ text, subcategory: selected.name }))
    await Promise.all(
      items.map(item =>
        fetch(`/api/lists/${groceryList.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
      )
    )
    setGroceryStatus(`Added ${items.length} ingredients to "${groceryList.title}"`)
  }

  function openAddNew() {
    setEditingRecipe(null)
    setShowForm(true)
    onAddNew()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Category filter bar */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-2 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setCatFilter(null)}
          className="rounded-full px-3 py-1 text-xs font-semibold border flex-shrink-0 transition-colors"
          style={{
            background:  catFilter === null ? 'var(--accent)' : 'transparent',
            color:       catFilter === null ? '#fff' : 'var(--text-dim)',
            borderColor: catFilter === null ? 'var(--accent)' : 'var(--border)',
          }}
        >
          All ({localRecipes.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = localRecipes.filter(r => r.category === cat).length
          if (count === 0) return null
          return (
            <button
              key={cat}
              onClick={() => setCatFilter(catFilter === cat ? null : cat)}
              className="rounded-full px-3 py-1 text-xs font-semibold border flex-shrink-0 transition-colors"
              style={{
                background:  catFilter === cat ? CAT_COLORS[cat] : 'transparent',
                color:       catFilter === cat ? '#fff' : 'var(--text-dim)',
                borderColor: catFilter === cat ? CAT_COLORS[cat] : 'var(--border)',
              }}
            >
              {CAT_EMOJIS[cat]} {CAT_LABELS[cat]} ({count})
            </button>
          )
        })}
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — recipe list */}
        <div
          className={`flex-shrink-0 flex flex-col overflow-hidden ${mobileView === 'detail' ? 'hidden md:flex' : 'flex'}`}
          style={{ width: 300, borderRight: '1px solid var(--border)' }}
        >
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-sm text-center" style={{ color: 'var(--text-dim)' }}>
                {localRecipes.length === 0
                  ? 'No recipes yet. Add your first recipe above.'
                  : 'No recipes in this category.'}
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map(recipe => {
                  const isSelected = selectedId === recipe.id
                  const color = catColor(recipe.category)
                  return (
                    <button
                      key={recipe.id}
                      onClick={() => { setSelectedId(recipe.id); setMobileView('detail') }}
                      className="text-left px-3 py-3 flex flex-col gap-0.5 transition-colors"
                      style={{
                        background:   isSelected ? 'var(--surface2)' : 'transparent',
                        borderBottom: '1px solid var(--border)',
                        borderLeft:   `3px solid ${isSelected ? color : 'transparent'}`,
                      }}
                    >
                      <div
                        className="text-sm font-semibold truncate"
                        style={{ color: isSelected ? color : 'var(--text)' }}
                      >
                        {recipe.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold" style={{ color }}>
                          {catEmoji(recipe.category)} {catLabel(recipe.category)}
                        </span>
                        {recipe.ingredients.length > 0 && (
                          <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                            {recipe.ingredients.length} ingredients
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Add recipe button at bottom of list */}
          <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={openAddNew}
              className="w-full py-2 rounded-lg text-sm font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              + New Recipe
            </button>
          </div>
        </div>

        {/* Right panel — detail */}
        <div className={`flex-1 overflow-hidden ${mobileView === 'list' ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
          {selected ? (
            <>
              {/* Mobile back button */}
              <div
                className="flex-shrink-0 md:hidden px-3 py-2"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <button
                  onClick={() => setMobileView('list')}
                  className="text-sm font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  ← Recipes
                </button>
              </div>
              <RecipeDetail
                recipe={selected}
                onEdit={() => { setEditingRecipe(selected); setShowForm(true) }}
                onDelete={() => handleDeleteRecipe(selected.id)}
                onPlanMeal={() => setPlanningRecipe(selected)}
                onAddToGrocery={handleAddToGrocery}
                groceryStatus={groceryStatus}
              />
            </>
          ) : (
            <div
              className="flex-1 flex items-center justify-center text-sm"
              style={{ color: 'var(--text-dim)' }}
            >
              Select a recipe to view details
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <RecipeForm
          recipe={editingRecipe}
          onClose={() => { setShowForm(false); setEditingRecipe(null) }}
          onSave={handleSaveRecipe}
        />
      )}
      {planningRecipe && (
        <PlanMealModal
          recipe={planningRecipe}
          onClose={() => setPlanningRecipe(null)}
          onPlan={handlePlanMeal}
        />
      )}
    </div>
  )
}

// ── MealsTab ─────────────────────────────────────────────────────────────────

export function MealsTab() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [subTab, setSubTab] = useState<'planner' | 'recipes'>('planner')

  const refreshTick = useAutoRefresh(30_000, { from: 1, to: 5 })

  // ── Planner state ──────────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = useState(() => weekStartFor(today))
  const [meals,     setMeals]     = useState<Record<string, DayMeals>>({})
  const [modal,     setModal]     = useState<ModalState | null>(null)

  // ── Recipes state ──────────────────────────────────────────────────────────
  const [recipes,        setRecipes]        = useState<Recipe[]>([])
  const [recipesVersion, setRecipesVersion] = useState(0)

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd   = weekDates[6]

  // Fetch planner meals — also re-runs on visibility change / 5-min poll
  useEffect(() => {
    const start = toDateKey(weekStart)
    const end   = toDateKey(weekEnd)
    fetch(`/api/meals?start=${start}&end=${end}`)
      .then(r => r.json())
      .then((data: Record<string, DayMeals>) => setMeals(data))
      .catch(() => {})
  }, [weekStart.toISOString(), refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch recipes when on that sub-tab — also re-runs on visibility change / 5-min poll
  useEffect(() => {
    if (subTab !== 'recipes') return
    fetch('/api/recipes')
      .then(r => r.json())
      .then((data: Recipe[]) => setRecipes(data))
      .catch(() => {})
  }, [subTab, recipesVersion, refreshTick])

  const prevWeek = useCallback(() => setWeekStart(s => addDays(s, -7)), [])
  const nextWeek = useCallback(() => setWeekStart(s => addDays(s, 7)), [])
  const goToday  = useCallback(() => setWeekStart(weekStartFor(today)), []) // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd(date: string, category: MealCategory) {
    setModal({ date, category, entry: null })
  }

  function openEdit(date: string, category: MealCategory, entry: MealEntry) {
    setModal({ date, category, entry })
  }

  async function handleSave(date: string, category: MealCategory, entry: MealEntry) {
    setModal(null)
    const res = await fetch(`/api/meals/${date}/${category}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    if (!res.ok) return
    setMeals(prev => {
      const day  = prev[date] ?? { breakfast: [], lunch: [], dinner: [], snack: [] }
      const list = day[category]
      const idx  = list.findIndex(e => e.id === entry.id)
      const updated = idx >= 0 ? list.map((e, i) => i === idx ? entry : e) : [...list, entry]
      return { ...prev, [date]: { ...day, [category]: updated } }
    })
  }

  async function handleDelete(date: string, category: MealCategory, entryId: string) {
    setModal(null)
    await fetch(`/api/meals/${date}/${category}?entryId=${entryId}`, { method: 'DELETE' })
    setMeals(prev => {
      const day = prev[date]
      if (!day) return prev
      return { ...prev, [date]: { ...day, [category]: day[category].filter(e => e.id !== entryId) } }
    })
  }

  const weekLabel = formatWeekLabel(weekStart)

  // ── InfoBar rightSlot ──────────────────────────────────────────────────────

  const subTabToggle = (
    <div className="flex items-center gap-0.5">
      {(['planner', 'recipes'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => setSubTab(tab)}
          className="px-3 py-1 rounded-md text-xs font-semibold transition-colors capitalize"
          style={{
            background: subTab === tab ? 'var(--accent)' : 'transparent',
            color:      subTab === tab ? '#fff' : 'var(--text-dim)',
          }}
        >
          {tab === 'planner' ? '🗓 Planner' : '📖 Recipes'}
        </button>
      ))}
    </div>
  )

  const infoRight = (
    <div className="flex items-center gap-2">
      {subTabToggle}
      <div className="h-4 border-l mx-1" style={{ borderColor: 'var(--border)' }} />
      {subTab === 'planner' ? (
        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="px-2 py-1 rounded text-sm font-bold transition-colors hover:bg-white/10"
            style={{ color: 'var(--text)' }}
          >‹</button>
          <button
            onClick={goToday}
            className="px-2 py-1 rounded text-xs font-semibold transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-dim)' }}
          >Today</button>
          <button
            onClick={nextWeek}
            className="px-2 py-1 rounded text-sm font-bold transition-colors hover:bg-white/10"
            style={{ color: 'var(--text)' }}
          >›</button>
        </div>
      ) : (
        <button
          onClick={() => setRecipesVersion(v => v + 1)}
          className="px-2 py-1 rounded text-xs font-semibold transition-colors hover:bg-white/10"
          style={{ color: 'var(--text-dim)' }}
          title="Refresh recipes"
        >
          ↻
        </button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <InfoBar rightSlot={infoRight} />

      {/* Planner view */}
      {subTab === 'planner' && (
        <>
          <div
            className="flex-shrink-0 px-4 py-2 text-sm font-semibold"
            style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}
          >
            {weekLabel}
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th
                    className="text-xs font-semibold text-left px-2 py-2 sticky left-0 z-10"
                    style={{ width: 90, background: 'var(--surface2)', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}
                  />
                  {weekDates.map((d, i) => {
                    const isToday = sameDay(d, today)
                    return (
                      <th
                        key={i}
                        className="text-center py-2 px-1 text-xs font-semibold"
                        style={{
                          borderBottom: '1px solid var(--border)',
                          borderLeft:   '1px solid var(--border)',
                          color:        isToday ? 'var(--accent)' : 'var(--text-dim)',
                          minWidth:     90,
                        }}
                      >
                        <div className="uppercase tracking-wide text-[10px]">{DOW[d.getDay()]}</div>
                        <div
                          className="text-lg font-bold leading-tight"
                          style={{
                            color:        isToday ? '#fff' : 'var(--text)',
                            background:   isToday ? 'var(--accent)' : 'transparent',
                            borderRadius: isToday ? '50%' : 0,
                            width:        isToday ? 28 : 'auto',
                            height:       isToday ? 28 : 'auto',
                            lineHeight:   isToday ? '28px' : undefined,
                            display:      'inline-flex',
                            alignItems:   'center',
                            justifyContent: 'center',
                            margin:       '0 auto',
                          }}
                        >
                          {d.getDate()}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map(cat => {
                  const color = CAT_COLORS[cat]
                  return (
                    <tr key={cat}>
                      <td
                        className="px-2 py-2 sticky left-0 z-10"
                        style={{
                          background:   'var(--surface2)',
                          borderBottom: '1px solid var(--border)',
                          borderRight:  '1px solid var(--border)',
                          verticalAlign: 'top',
                        }}
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span style={{ fontSize: 14 }}>{CAT_EMOJIS[cat]}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
                            {CAT_LABELS[cat]}
                          </span>
                        </div>
                      </td>
                      {weekDates.map((d, di) => {
                        const dateKey  = toDateKey(d)
                        const dayMeals = meals[dateKey]
                        const entries  = dayMeals?.[cat] ?? []
                        const isToday  = sameDay(d, today)
                        return (
                          <td
                            key={di}
                            className="px-1 py-1 align-top"
                            style={{
                              borderBottom: '1px solid var(--border)',
                              borderLeft:   '1px solid var(--border)',
                              minHeight:    56,
                              background:   isToday ? 'rgba(108,140,255,0.04)' : 'transparent',
                            }}
                          >
                            <div className="flex flex-col gap-1 min-h-[48px]">
                              {entries.map(entry => (
                                <button
                                  key={entry.id}
                                  onClick={() => openEdit(dateKey, cat, entry)}
                                  className="text-left text-[11px] font-semibold px-1.5 py-[2px] rounded w-full truncate transition-all"
                                  style={{
                                    background:  `${color}22`,
                                    color,
                                    borderLeft:  `3px solid ${color}`,
                                    borderRadius: '0 3px 3px 0',
                                  }}
                                  title={entry.name}
                                >
                                  {entry.repeat && <span className="mr-0.5 opacity-60">↻</span>}
                                  {entry.recipeId && <span className="mr-0.5 opacity-60">📖</span>}
                                  {entry.name}
                                </button>
                              ))}
                              <button
                                onClick={() => openAdd(dateKey, cat)}
                                className="text-[10px] opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity px-1.5 py-[1px] rounded"
                                style={{ color: 'var(--text-faint)' }}
                                title={`Add ${CAT_LABELS[cat]}`}
                              >
                                + add
                              </button>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Recipes view */}
      {subTab === 'recipes' && (
        <RecipesView
          recipes={recipes}
          onAddNew={() => {}}
        />
      )}

      {modal && (
        <MealModal
          state={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

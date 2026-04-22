'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AppList, ListItem, ListType } from '@/lib/calendar/types'

// ── Constants ─────────────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
]

const TYPE_LABELS: Record<ListType, string> = {
  todo:    '☑️ To Do',
  grocery: '🛒 Grocery',
  other:   '📌 Other',
}

// ── Helpers ───────────────────────────────────────────────────────────────

function itemCount(list: AppList) {
  const total   = list.items.length
  const checked = list.items.filter(it => it.checked).length
  return { total, checked }
}

function groupBySubcategory(items: ListItem[]): { label: string | null; items: ListItem[] }[] {
  const ordered = [...items].sort((a, b) => a.order - b.order)
  const groups: { label: string | null; items: ListItem[] }[] = []
  const seen = new Map<string | null, ListItem[]>()

  for (const item of ordered) {
    const key = item.subcategory ?? null
    if (!seen.has(key)) {
      const arr: ListItem[] = []
      seen.set(key, arr)
      groups.push({ label: key, items: arr })
    }
    seen.get(key)!.push(item)
  }

  return groups
}

// ── ListForm (add / edit list) ────────────────────────────────────────────

interface ListFormProps {
  list?: AppList
  onSave: (data: { title: string; type: ListType; color: string }) => void
  onDelete?: () => void
  onClose: () => void
}

function ListForm({ list, onSave, onDelete, onClose }: ListFormProps) {
  const [title,  setTitle]  = useState(list?.title ?? '')
  const [type,   setType]   = useState<ListType>(list?.type ?? 'todo')
  const [color,  setColor]  = useState(list?.color ?? COLOR_SWATCHES[0])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), type, color })
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 200,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px 16px 0 0',
        padding: '24px 20px', width: '100%', maxWidth: 520,
        boxShadow: '0 -4px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {list ? 'Edit List' : 'New List'}
          </span>
          <button type="button" onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Title */}
        <label style={labelStyle}>Title</label>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="List name…"
          style={inputStyle}
        />

        {/* Type */}
        <label style={labelStyle}>Type</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['todo', 'grocery', 'other'] as ListType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: type === t ? `${color}22` : 'var(--surface2)',
                border: `2px solid ${type === t ? color : 'var(--border)'}`,
                color: type === t ? color : 'var(--text-dim)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Color */}
        <label style={labelStyle}>Color</label>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {COLOR_SWATCHES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: c, border: `3px solid ${color === c ? 'var(--text)' : 'transparent'}`,
                cursor: 'pointer', transition: 'border 0.15s', flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || saving}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: color, border: 'none',
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: title.trim() ? 'pointer' : 'not-allowed',
            opacity: title.trim() ? 1 : 0.5, marginBottom: onDelete ? 10 : 0,
          }}
        >
          {saving ? 'Saving…' : list ? 'Save Changes' : 'Create List'}
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              background: 'none', border: '1px solid var(--border)',
              color: '#f87171', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Delete List
          </button>
        )}
      </div>
    </div>
  )
}

// ── ListDetail (full-screen list view) ────────────────────────────────────

interface ListDetailProps {
  list: AppList
  onBack: () => void
  onListUpdated: (list: AppList) => void
  onEditList: () => void
}

function ListDetail({ list, onBack, onListUpdated, onEditList }: ListDetailProps) {
  const [showChecked, setShowChecked] = useState(true)
  const [newText,     setNewText]     = useState('')
  const [newSubcat,   setNewSubcat]   = useState('')
  const [showSubcat,  setShowSubcat]  = useState(false)
  const [adding,      setAdding]      = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const checkedCount = list.items.filter(it => it.checked).length

  const visibleItems = showChecked
    ? list.items
    : list.items.filter(it => !it.checked)

  const groups = groupBySubcategory(visibleItems)

  const existingSubcats = Array.from(
    new Set(list.items.map(it => it.subcategory).filter(Boolean) as string[])
  )

  const handleToggle = useCallback(async (item: ListItem) => {
    const res = await fetch(`/api/lists/${list.id}/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: !item.checked }),
    })
    if (res.ok) onListUpdated(await res.json())
  }, [list.id, onListUpdated])

  const handleDeleteItem = useCallback(async (itemId: string) => {
    const res = await fetch(`/api/lists/${list.id}/items/${itemId}`, { method: 'DELETE' })
    if (res.ok) onListUpdated(await res.json())
  }, [list.id, onListUpdated])

  const handleAddItem = useCallback(async () => {
    if (!newText.trim()) return
    setAdding(true)
    const res = await fetch(`/api/lists/${list.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: newText.trim(),
        subcategory: newSubcat.trim() || undefined,
      }),
    })
    if (res.ok) {
      onListUpdated(await res.json())
      setNewText('')
      setNewSubcat('')
      setShowSubcat(false)
      inputRef.current?.focus()
    }
    setAdding(false)
  }, [list.id, newText, newSubcat, onListUpdated])

  const handleClearChecked = useCallback(async () => {
    const res = await fetch(`/api/lists/${list.id}/clear-checked`, { method: 'POST' })
    if (res.ok) onListUpdated(await res.json())
  }, [list.id, onListUpdated])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <button type="button" onClick={onBack} style={{
          background: 'none', border: 'none', color: list.color,
          fontSize: 20, cursor: 'pointer', padding: '4px 8px 4px 0',
          display: 'flex', alignItems: 'center',
        }}>
          ←
        </button>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: list.color, flexShrink: 0,
        }} />
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          {list.title}
        </span>
        <span style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 10,
          background: 'var(--surface2)', color: 'var(--text-dim)', fontWeight: 500,
        }}>
          {TYPE_LABELS[list.type]}
        </span>

        {/* Controls */}
        {checkedCount > 0 && (
          <button type="button" onClick={handleClearChecked} style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-dim)', fontSize: 12,
            padding: '5px 10px', cursor: 'pointer',
          }}>
            Clear {checkedCount} done
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowChecked(s => !s)}
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, color: showChecked ? list.color : 'var(--text-dim)',
            fontSize: 12, padding: '5px 10px', cursor: 'pointer',
          }}
        >
          {showChecked ? 'Hide done' : 'Show done'}
        </button>
        <button type="button" onClick={onEditList} style={{
          background: 'none', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-dim)', fontSize: 12,
          padding: '5px 10px', cursor: 'pointer',
        }}>
          Edit
        </button>
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {groups.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 10, marginTop: 60,
            color: 'var(--text-dim)',
          }}>
            <span style={{ fontSize: 40 }}>📋</span>
            <div style={{ fontSize: 15 }}>No items yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Add your first item below</div>
          </div>
        ) : (
          groups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--text-faint)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '14px 4px 6px',
                }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  accentColor={list.color}
                  onToggle={handleToggle}
                  onDelete={handleDeleteItem}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Add item input */}
      <div style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0, padding: '10px 12px',
      }}>
        {showSubcat && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>Section:</span>
            <input
              value={newSubcat}
              onChange={e => setNewSubcat(e.target.value)}
              placeholder={existingSubcats.length > 0 ? existingSubcats.join(', ') + ' or new…' : 'Section name…'}
              style={{ ...inputStyle, marginBottom: 0, flex: 1, padding: '7px 10px' }}
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowSubcat(s => !s)}
            title="Add to section"
            style={{
              background: showSubcat ? `${list.color}22` : 'var(--surface2)',
              border: `1px solid ${showSubcat ? list.color : 'var(--border)'}`,
              borderRadius: 8, color: showSubcat ? list.color : 'var(--text-faint)',
              fontSize: 14, width: 34, height: 38, cursor: 'pointer', flexShrink: 0,
            }}
          >
            §
          </button>
          <input
            ref={inputRef}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddItem()}
            placeholder="Add item…"
            style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
          />
          <button
            type="button"
            onClick={handleAddItem}
            disabled={!newText.trim() || adding}
            style={{
              padding: '0 18px', height: 38, borderRadius: 8,
              background: list.color, border: 'none',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: newText.trim() ? 'pointer' : 'not-allowed',
              opacity: newText.trim() ? 1 : 0.45, flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ItemRow ───────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ListItem
  accentColor: string
  onToggle: (item: ListItem) => void
  onDelete: (id: string) => void
}

function ItemRow({ item, accentColor, onToggle, onDelete }: ItemRowProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 4px', borderBottom: '1px solid var(--border)',
        background: hovered ? 'var(--surface2)' : 'transparent',
        borderRadius: 6, transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(item)}
        style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${item.checked ? accentColor : 'var(--border)'}`,
          background: item.checked ? accentColor : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {item.checked && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
      </button>

      {/* Text */}
      <span style={{
        flex: 1, fontSize: 15, color: item.checked ? 'var(--text-faint)' : 'var(--text)',
        textDecoration: item.checked ? 'line-through' : 'none',
        transition: 'all 0.15s',
      }}>
        {item.text}
      </span>

      {/* Delete */}
      {(hovered || item.checked) && (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-faint)',
            fontSize: 14, cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ── ListCard ──────────────────────────────────────────────────────────────

interface ListCardProps {
  list: AppList
  onClick: () => void
}

function ListCard({ list, onClick }: ListCardProps) {
  const { total, checked } = itemCount(list)
  const pct = total > 0 ? (checked / total) * 100 : 0

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        background: 'var(--surface)',
        border: `1px solid var(--border)`,
        borderTop: `4px solid ${list.color}`,
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        cursor: 'pointer', textAlign: 'left',
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.transform = ''
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = ''
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
          {list.title}
        </span>
        <span style={{
          fontSize: 11, padding: '2px 7px', borderRadius: 8,
          background: `${list.color}22`, color: list.color, fontWeight: 600,
        }}>
          {TYPE_LABELS[list.type].split(' ')[1]}
        </span>
      </div>

      {total > 0 ? (
        <>
          <div style={{
            height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: list.color,
              width: `${pct}%`, transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {checked} of {total} done
          </span>
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>No items yet</span>
      )}
    </button>
  )
}

// ── ListsTab ──────────────────────────────────────────────────────────────

export function ListsTab() {
  const [lists,       setLists]       = useState<AppList[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [editList,    setEditList]    = useState<AppList | null>(null)

  const selectedList = lists.find(l => l.id === selectedId) ?? null

  useEffect(() => {
    fetch('/api/lists')
      .then(r => r.json())
      .then(data => { setLists(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  const handleListUpdated = useCallback((updated: AppList) => {
    setLists(prev => prev.map(l => l.id === updated.id ? updated : l))
  }, [])

  const handleSaveList = useCallback(async (data: { title: string; type: ListType; color: string }) => {
    if (editList) {
      const res = await fetch(`/api/lists/${editList.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) handleListUpdated(await res.json())
    } else {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const created = await res.json()
        setLists(prev => [...prev, created])
        setSelectedId(created.id)
      }
    }
    setShowForm(false)
    setEditList(null)
  }, [editList, handleListUpdated])

  const handleDeleteList = useCallback(async () => {
    if (!editList) return
    await fetch(`/api/lists/${editList.id}`, { method: 'DELETE' })
    setLists(prev => prev.filter(l => l.id !== editList.id))
    if (selectedId === editList.id) setSelectedId(null)
    setShowForm(false)
    setEditList(null)
  }, [editList, selectedId])

  // ── Detail view ────────────────────────────────────────────────────────

  if (selectedList) {
    return (
      <>
        <ListDetail
          list={selectedList}
          onBack={() => setSelectedId(null)}
          onListUpdated={handleListUpdated}
          onEditList={() => { setEditList(selectedList); setShowForm(true) }}
        />
        {showForm && (
          <ListForm
            list={editList ?? undefined}
            onSave={handleSaveList}
            onDelete={editList ? handleDeleteList : undefined}
            onClose={() => { setShowForm(false); setEditList(null) }}
          />
        )}
      </>
    )
  }

  // ── Grid view ──────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Lists</span>
        <button
          type="button"
          onClick={() => { setEditList(null); setShowForm(true) }}
          style={{
            padding: '8px 16px', borderRadius: 10,
            background: 'var(--accent)', border: 'none',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          + New List
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 60 }}>Loading…</div>
        ) : lists.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, marginTop: 80,
            color: 'var(--text-dim)',
          }}>
            <span style={{ fontSize: 48 }}>📋</span>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No lists yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>
              Tap + New List to create a shopping list, to-do, or anything else
            </div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 14,
          }}>
            {lists.map(list => (
              <ListCard
                key={list.id}
                list={list}
                onClick={() => setSelectedId(list.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ListForm
          list={editList ?? undefined}
          onSave={handleSaveList}
          onDelete={editList ? handleDeleteList : undefined}
          onClose={() => { setShowForm(false); setEditList(null) }}
        />
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 15, outline: 'none',
  boxSizing: 'border-box', marginBottom: 16,
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text-dim)', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: 'none',
  borderRadius: '50%', width: 32, height: 32,
  color: 'var(--text-dim)', fontSize: 14,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

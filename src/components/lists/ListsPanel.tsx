'use client'

import { useRef, useState } from 'react'
import { MealPlanPanel } from './MealPlanPanel'

const DEFAULT_WIDTH = 280
const MIN_WIDTH = 220
const MAX_WIDTH = 520
const COLLAPSED_WIDTH = 44

type ListsTab = 'meals' | 'shopping' | 'todos'

const TABS: { id: ListsTab; label: string; icon: string }[] = [
  { id: 'meals', label: 'Meals', icon: '🍽' },
  { id: 'shopping', label: 'Shopping', icon: '🛒' },
  { id: 'todos', label: 'To-Do', icon: '✓' },
]

export function ListsPanel() {
  const [tab, setTab] = useState<ListsTab>('meals')
  const [collapsed, setCollapsed] = useState(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)

  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(DEFAULT_WIDTH)

  function startResize(clientX: number) {
    isDragging.current = true
    dragStartX.current = clientX
    dragStartWidth.current = width

    function onMove(e: MouseEvent | TouchEvent) {
      if (!isDragging.current) return
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX
      const delta = x - dragStartX.current
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidth.current + delta)))
    }
    function onUp() {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onUp)
  }

  if (collapsed) {
    return (
      <aside
        style={{
          width: COLLAPSED_WIDTH,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          gap: 6,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          title="Expand"
          style={{
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 14,
            marginBottom: 4,
          }}
        >
          ›
        </button>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setCollapsed(false) }}
            title={t.label}
            style={{
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: tab === t.id ? 'var(--accent-glow)' : 'transparent',
              border: '1px solid transparent',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {t.icon}
          </button>
        ))}
      </aside>
    )
  }

  return (
    <aside
      style={{
        width,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar + collapse button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '9px 0',
              fontSize: 11,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-dim)',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse"
          style={{
            padding: '9px 10px',
            background: 'transparent',
            border: 'none',
            borderBottom: '2px solid transparent',
            color: 'var(--text-faint)',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ‹
        </button>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'meals' && <MealPlanPanel />}
        {tab === 'shopping' && <StubTab icon="🛒" label="Shopping list coming soon" />}
        {tab === 'todos' && <StubTab icon="✓" label="To-Do list coming soon" />}
      </div>

      {/* Right-edge resize handle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 5,
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 10,
        }}
        onMouseDown={e => { e.preventDefault(); startResize(e.clientX) }}
        onTouchStart={e => startResize(e.touches[0].clientX)}
      />
    </aside>
  )
}

function StubTab({ icon, label }: { icon: string; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 10,
        color: 'var(--text-faint)',
        padding: 20,
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 32 }}>{icon}</span>
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  )
}

/* ── Mobile drawer version (used in page.tsx for small screens) ── */

interface MobileListsDrawerProps {
  open: boolean
  onClose: () => void
}

export function MobileListsDrawer({ open, onClose }: MobileListsDrawerProps) {
  const [tab, setTab] = useState<ListsTab>('meals')

  return (
    <>
      <div
        className="fixed inset-0 z-40 md:hidden transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex flex-col transition-transform duration-300"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '16px 16px 0 0',
          maxHeight: '70dvh',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? 'var(--accent)' : 'var(--text-dim)',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={onClose}
            style={{
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {tab === 'meals' && <MealPlanPanel />}
          {tab === 'shopping' && <StubTab icon="🛒" label="Shopping list coming soon" />}
          {tab === 'todos' && <StubTab icon="✓" label="To-Do list coming soon" />}
        </div>
      </div>
    </>
  )
}

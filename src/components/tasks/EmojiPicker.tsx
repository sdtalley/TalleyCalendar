'use client'

import { useState, useMemo } from 'react'

const EMOJI_GROUPS = [
  { label: 'Household', emojis: ['🧹', '🧺', '🧼', '🚿', '🛁', '🚽', '🧻', '🧽', '🍽️', '🥤', '🍳', '🛒', '🛋️', '🛏️', '🪟', '🚪', '🗑️', '🧴', '🧷', '🪣'] },
  { label: 'Outdoor',   emojis: ['🌱', '🌿', '🍂', '🌳', '🌲', '🐕', '🐈', '🐟', '🚗', '🏡', '🌻', '🪴', '🍃', '🌾'] },
  { label: 'School',    emojis: ['📚', '📖', '✏️', '🎒', '💻', '📝', '✅', '🔬', '🎨', '📐', '📏', '🖊️'] },
  { label: 'Activities',emojis: ['🎮', '🎵', '🎸', '🎺', '🎻', '🏃', '🤸', '⚽', '🏀', '⚾', '🎾', '🏊', '🎯', '🎲'] },
  { label: 'Food',      emojis: ['🍎', '🥦', '🥕', '🍌', '🧃', '🥛', '🍞', '🥗', '🍕', '🌮', '🍜'] },
  { label: 'Stars',     emojis: ['⭐', '🌟', '💫', '✨', '🎉', '🎊', '🏆', '🥇', '🎁', '💡', '❤️', '💪'] },
]

const ALL_EMOJIS = EMOJI_GROUPS.flatMap(g => g.emojis)

interface EmojiPickerProps {
  value?: string
  onChange: (emoji: string) => void
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return null  // show grouped view
    // Simple filter: show emojis that contain the search term (not useful for emoji chars
    // but lets users type emoji directly to confirm)
    return ALL_EMOJIS
  }, [search])

  const groups = filtered
    ? [{ label: 'Results', emojis: filtered }]
    : EMOJI_GROUPS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        type="text"
        placeholder="Search or paste emoji…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 4 }}
      />
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(group => (
          <div key={group.label}>
            <div className="section-title" style={{ marginBottom: 6 }}>{group.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {group.emojis.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onChange(emoji)}
                  style={{
                    width: 40,
                    height: 40,
                    fontSize: 22,
                    borderRadius: 8,
                    border: value === emoji ? '2px solid var(--accent)' : '2px solid transparent',
                    background: value === emoji ? 'var(--accent-glow)' : 'var(--surface3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.1s',
                    flexShrink: 0,
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

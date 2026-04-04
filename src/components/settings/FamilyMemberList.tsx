'use client'

import { useState } from 'react'
import type { FamilyMember } from '@/lib/calendar/types'

const PRESET_COLORS = [
  '#6c8cff', '#ff6b8a', '#4ecdc4', '#ffd166', '#a78bfa', '#ff8c42',
  '#f472b6', '#34d399', '#fbbf24', '#818cf8', '#fb923c', '#22d3ee',
]

interface FamilyMemberListProps {
  members: FamilyMember[]
  onAdd: (member: Omit<FamilyMember, 'id'>) => Promise<void>
  onUpdate: (id: string, updates: Partial<Omit<FamilyMember, 'id'>>) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export function FamilyMemberList({ members, onAdd, onUpdate, onRemove }: FamilyMemberListProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)

  function startAdd() {
    setAdding(true)
    setEditingId(null)
    setName('')
    setColor(PRESET_COLORS[members.length % PRESET_COLORS.length])
  }

  function startEdit(member: FamilyMember) {
    setEditingId(member.id)
    setAdding(false)
    setName(member.name)
    setColor(member.color)
  }

  function cancel() {
    setAdding(false)
    setEditingId(null)
    setName('')
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (adding) {
        await onAdd({ name: name.trim(), color })
      } else if (editingId) {
        await onUpdate(editingId, { name: name.trim(), color })
      }
      cancel()
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string, memberName: string) {
    if (!confirm(`Remove ${memberName}? This will also disconnect all their calendar accounts.`)) return
    setSaving(true)
    try {
      await onRemove(id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Family Members</h2>
        {!adding && !editingId && (
          <button onClick={startAdd} className="settings-btn-primary">
            + Add Member
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {members.map(member => (
          <div key={member.id}>
            {editingId === member.id ? (
              <MemberForm
                name={name}
                color={color}
                onNameChange={setName}
                onColorChange={setColor}
                onSave={handleSave}
                onCancel={cancel}
                saving={saving}
                saveLabel="Save"
              />
            ) : (
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ background: member.color }}
                  />
                  <span className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>
                    {member.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(member)}
                    className="settings-btn-ghost"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(member.id, member.name)}
                    className="settings-btn-ghost"
                    style={{ color: '#ff6b6b' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding && (
          <MemberForm
            name={name}
            color={color}
            onNameChange={setName}
            onColorChange={setColor}
            onSave={handleSave}
            onCancel={cancel}
            saving={saving}
            saveLabel="Add"
          />
        )}
      </div>

      {members.length === 0 && !adding && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-faint)' }}>
          No family members yet. Add one to get started.
        </p>
      )}
    </div>
  )
}

function MemberForm({
  name, color, onNameChange, onColorChange, onSave, onCancel, saving, saveLabel,
}: {
  name: string
  color: string
  onNameChange: (v: string) => void
  onColorChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  saveLabel: string
}) {
  return (
    <div
      className="px-4 py-4 rounded-xl flex flex-col gap-3"
      style={{ background: 'var(--surface2)', border: '1px solid var(--accent)' }}
    >
      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="field-label">Name</label>
          <input
            type="text"
            placeholder="e.g. Dad, Mom, Alex"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSave()}
            autoFocus
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="field-label">Color</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className="w-8 h-8 rounded-full cursor-pointer border-2 transition-all duration-150"
              style={{
                background: c,
                borderColor: color === c ? '#fff' : 'transparent',
                transform: color === c ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="settings-btn-secondary" disabled={saving}>
          Cancel
        </button>
        <button onClick={onSave} className="settings-btn-primary" disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  )
}

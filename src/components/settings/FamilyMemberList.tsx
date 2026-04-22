'use client'

import { useState } from 'react'
import type { FamilyMember } from '@/lib/calendar/types'

const PRESET_COLORS = [
  '#6c8cff', '#ff6b8a', '#4ecdc4', '#ffd166', '#a78bfa', '#ff8c42',
  '#f472b6', '#34d399', '#fbbf24', '#818cf8', '#fb923c', '#22d3ee',
]

const PROFILE_CATEGORIES = ['Birthdays', 'Pets', 'Sports', 'School', 'Holidays']

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

function getAvatarContent(member: FamilyMember): string {
  if (member.avatar?.type === 'emoji') return member.avatar.value || '👤'
  if (member.avatar?.type === 'initials' && member.avatar.value) return member.avatar.value
  return getInitials(member.name)
}

function MemberAvatarDisplay({ member, size = 32 }: { member: FamilyMember; size?: number }) {
  const content = getAvatarContent(member)
  const isEmoji = member.avatar?.type === 'emoji'
  return (
    <span
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: member.color,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isEmoji ? size * 0.55 : size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {content}
    </span>
  )
}

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
  const [localOnly, setLocalOnly] = useState(false)
  const [defaultCalendarType, setDefaultCalendarType] = useState<'kids' | 'shared'>('shared')
  const [avatarType, setAvatarType] = useState<'initials' | 'emoji'>('initials')
  const [avatarValue, setAvatarValue] = useState('')
  const [profileType, setProfileType] = useState<'person' | 'other'>('person')
  const [profileCategory, setProfileCategory] = useState('')
  const [saving, setSaving] = useState(false)

  function startAdd() {
    setAdding(true)
    setEditingId(null)
    setName('')
    setColor(PRESET_COLORS[members.length % PRESET_COLORS.length])
    setLocalOnly(false)
    setDefaultCalendarType('shared')
    setAvatarType('initials')
    setAvatarValue('')
    setProfileType('person')
    setProfileCategory('')
  }

  function startEdit(member: FamilyMember) {
    setEditingId(member.id)
    setAdding(false)
    setName(member.name)
    setColor(member.color)
    setLocalOnly(member.localOnly ?? false)
    setDefaultCalendarType(member.defaultCalendarType ?? 'shared')
    setAvatarType(member.avatar?.type ?? 'initials')
    setAvatarValue(member.avatar?.value ?? '')
    setProfileType(member.profileType ?? 'person')
    setProfileCategory(member.profileCategory ?? '')
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
      const payload: Omit<FamilyMember, 'id'> = {
        name: name.trim(),
        color,
        localOnly: localOnly || undefined,
        defaultCalendarType: localOnly ? defaultCalendarType : undefined,
        avatar: avatarValue.trim()
          ? { type: avatarType, value: avatarValue.trim() }
          : undefined,
        profileType: profileType === 'other' ? 'other' : undefined,
        profileCategory: profileType === 'other' && profileCategory.trim()
          ? profileCategory.trim()
          : undefined,
      }
      if (adding) {
        await onAdd(payload)
      } else if (editingId) {
        await onUpdate(editingId, payload)
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
                name={name} color={color} localOnly={localOnly}
                defaultCalendarType={defaultCalendarType}
                avatarType={avatarType} avatarValue={avatarValue}
                profileType={profileType} profileCategory={profileCategory}
                onNameChange={setName} onColorChange={setColor}
                onLocalOnlyChange={setLocalOnly}
                onDefaultCalendarTypeChange={setDefaultCalendarType}
                onAvatarTypeChange={setAvatarType} onAvatarValueChange={setAvatarValue}
                onProfileTypeChange={setProfileType}
                onProfileCategoryChange={setProfileCategory}
                onSave={handleSave} onCancel={cancel} saving={saving} saveLabel="Save"
              />
            ) : (
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <MemberAvatarDisplay member={member} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-medium" style={{ color: 'var(--text)' }}>
                        {member.name}
                      </span>
                      {member.profileType === 'other' && member.profileCategory && (
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'var(--surface3)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
                        >
                          {member.profileCategory}
                        </span>
                      )}
                      {member.localOnly && (
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: member.defaultCalendarType === 'kids'
                              ? 'rgba(78,205,196,0.15)'
                              : 'rgba(108,140,255,0.15)',
                            color: member.defaultCalendarType === 'kids' ? '#4ecdc4' : '#6c8cff',
                          }}
                        >
                          {member.defaultCalendarType === 'kids' ? 'Kids · Local' : 'Family · Local'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(member)} className="settings-btn-ghost">Edit</button>
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
            name={name} color={color} localOnly={localOnly}
            defaultCalendarType={defaultCalendarType}
            avatarType={avatarType} avatarValue={avatarValue}
            profileType={profileType} profileCategory={profileCategory}
            onNameChange={setName} onColorChange={setColor}
            onLocalOnlyChange={setLocalOnly}
            onDefaultCalendarTypeChange={setDefaultCalendarType}
            onAvatarTypeChange={setAvatarType} onAvatarValueChange={setAvatarValue}
            onProfileTypeChange={setProfileType}
            onProfileCategoryChange={setProfileCategory}
            onSave={handleSave} onCancel={cancel} saving={saving} saveLabel="Add"
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

// ── MemberForm ─────────────────────────────────────────────────────────────

interface MemberFormProps {
  name: string
  color: string
  localOnly: boolean
  defaultCalendarType: 'kids' | 'shared'
  avatarType: 'initials' | 'emoji'
  avatarValue: string
  profileType: 'person' | 'other'
  profileCategory: string
  onNameChange: (v: string) => void
  onColorChange: (v: string) => void
  onLocalOnlyChange: (v: boolean) => void
  onDefaultCalendarTypeChange: (v: 'kids' | 'shared') => void
  onAvatarTypeChange: (v: 'initials' | 'emoji') => void
  onAvatarValueChange: (v: string) => void
  onProfileTypeChange: (v: 'person' | 'other') => void
  onProfileCategoryChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  saveLabel: string
}

function MemberForm({
  name, color, localOnly, defaultCalendarType,
  avatarType, avatarValue, profileType, profileCategory,
  onNameChange, onColorChange, onLocalOnlyChange, onDefaultCalendarTypeChange,
  onAvatarTypeChange, onAvatarValueChange, onProfileTypeChange, onProfileCategoryChange,
  onSave, onCancel, saving, saveLabel,
}: MemberFormProps) {
  const previewMember: FamilyMember = {
    id: '', name, color,
    avatar: avatarValue.trim() ? { type: avatarType, value: avatarValue.trim() } : undefined,
  }

  return (
    <div
      className="px-4 py-4 rounded-xl flex flex-col gap-3"
      style={{ background: 'var(--surface2)', border: '1px solid var(--accent)' }}
    >
      {/* Name */}
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

      {/* Color */}
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

      {/* Avatar */}
      <div className="flex flex-col gap-1.5">
        <label className="field-label">Avatar</label>
        <div className="flex items-center gap-3">
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {(['initials', 'emoji'] as const).map(t => (
              <button
                key={t}
                onClick={() => onAvatarTypeChange(t)}
                className="px-3 py-1.5 text-[12px] font-medium border-none cursor-pointer transition-all"
                style={{
                  background: avatarType === t ? 'var(--accent)' : 'transparent',
                  color: avatarType === t ? '#fff' : 'var(--text-dim)',
                }}
              >
                {t === 'initials' ? 'Initials' : 'Emoji'}
              </button>
            ))}
          </div>
          {avatarType === 'emoji' ? (
            <input
              type="text"
              placeholder="✨"
              value={avatarValue}
              onChange={e => onAvatarValueChange(e.target.value.slice(-2))}
              style={{ width: 56, textAlign: 'center', fontSize: 20 }}
            />
          ) : (
            <input
              type="text"
              placeholder={getInitials(name) || 'AB'}
              value={avatarValue}
              onChange={e => onAvatarValueChange(e.target.value.slice(0, 2).toUpperCase())}
              maxLength={2}
              style={{ width: 56, textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: 15 }}
            />
          )}
          <MemberAvatarDisplay member={previewMember} size={40} />
        </div>
      </div>

      {/* Profile type */}
      <div className="flex flex-col gap-1.5">
        <label className="field-label">Profile Type</label>
        <div className="flex gap-2">
          {(['person', 'other'] as const).map(pt => (
            <button
              key={pt}
              onClick={() => onProfileTypeChange(pt)}
              className="flex-1 py-2 rounded-lg text-[13px] font-medium border cursor-pointer transition-all duration-150"
              style={{
                background: profileType === pt ? 'var(--accent)' : 'var(--surface3)',
                borderColor: profileType === pt ? 'var(--accent)' : 'var(--border)',
                color: profileType === pt ? '#fff' : 'var(--text-dim)',
              }}
            >
              {pt === 'person' ? 'Person' : 'Other (Pets, Birthdays…)'}
            </button>
          ))}
        </div>
      </div>

      {/* Category — when profileType = other */}
      {profileType === 'other' && (
        <div className="flex flex-col gap-1.5">
          <label className="field-label">Category</label>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {PROFILE_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => onProfileCategoryChange(cat)}
                className="px-2.5 py-1 rounded-full text-[12px] font-medium border-none cursor-pointer transition-all"
                style={{
                  background: profileCategory === cat ? 'var(--accent)' : 'var(--surface3)',
                  color: profileCategory === cat ? '#fff' : 'var(--text-dim)',
                  border: `1px solid ${profileCategory === cat ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Or type a custom category"
            value={profileCategory}
            onChange={e => onProfileCategoryChange(e.target.value)}
          />
        </div>
      )}

      {/* Local-only toggle */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer"
        style={{ background: 'var(--surface3)', border: '1px solid var(--border)' }}
        onClick={() => onLocalOnlyChange(!localOnly)}
      >
        <div>
          <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
            No external calendar account
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Events stored locally — ideal for kids or a shared Family calendar
          </div>
        </div>
        <div
          className="w-10 h-5 rounded-full flex-shrink-0 ml-3 transition-all duration-200 relative"
          style={{ background: localOnly ? 'var(--accent)' : 'var(--border)' }}
        >
          <div
            className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
            style={{
              background: '#fff',
              left: localOnly ? '22px' : '2px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      </div>

      {/* Calendar type — local only */}
      {localOnly && (
        <div className="flex flex-col gap-1.5">
          <label className="field-label">Calendar type</label>
          <div className="flex gap-2">
            {([
              { id: 'shared', label: 'Family / Shared' },
              { id: 'kids', label: 'Kids' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => onDefaultCalendarTypeChange(opt.id)}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium border cursor-pointer transition-all duration-150"
                style={{
                  background: defaultCalendarType === opt.id ? 'var(--accent)' : 'var(--surface3)',
                  borderColor: defaultCalendarType === opt.id ? 'var(--accent)' : 'var(--border)',
                  color: defaultCalendarType === opt.id ? '#fff' : 'var(--text-dim)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

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

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { InfoBar } from '@/components/layout/InfoBar'
import type { Reward, StarTransaction, FamilyMember } from '@/lib/calendar/types'

// ── Helpers ───────────────────────────────────────────────────────────────

function getMemberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

function getAvatarContent(m: FamilyMember): string {
  if (m.avatar?.type === 'emoji') return m.avatar.value
  if (m.avatar?.type === 'initials' && m.avatar.value) return m.avatar.value
  return getMemberInitials(m.name)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── RewardForm ────────────────────────────────────────────────────────────

interface RewardFormProps {
  reward?: Reward
  members: FamilyMember[]
  onSave: (data: Omit<Reward, 'id' | 'createdAt' | 'redeemedByMemberIds'>) => void
  onDelete?: () => void
  onClose: () => void
}

function RewardForm({ reward, members, onSave, onDelete, onClose }: RewardFormProps) {
  const [title,     setTitle]     = useState(reward?.title ?? '')
  const [emoji,     setEmoji]     = useState(reward?.emoji ?? '')
  const [starCost,  setStarCost]  = useState(reward?.starCost ?? 10)
  const [memberIds, setMemberIds] = useState<string[]>(reward?.memberIds ?? members.map(m => m.id))
  const [recurring, setRecurring] = useState(reward?.recurring ?? false)
  const [saving,    setSaving]    = useState(false)

  const toggleMember = (id: string) =>
    setMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSave = async () => {
    if (!title.trim() || memberIds.length === 0) return
    setSaving(true)
    await onSave({ title: title.trim(), emoji: emoji.trim() || undefined, starCost, memberIds, recurring })
    setSaving(false)
  }

  const COST_PRESETS = [5, 10, 25, 50, 100, 250]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: '24px 20px', width: '100%', maxWidth: 540, boxShadow: '0 -4px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{reward ? 'Edit Reward' : 'New Reward'}</span>
          <button type="button" onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Emoji + Title */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
            placeholder="🎁"
            style={{ ...inputStyle, width: 60, textAlign: 'center', fontSize: 22, marginBottom: 0, flexShrink: 0 }}
          />
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Reward name…"
            style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
          />
        </div>

        {/* Star cost */}
        <label style={labelStyle}>Star Cost</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {COST_PRESETS.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setStarCost(n)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: starCost === n ? 'var(--accent-glow)' : 'var(--surface2)',
                border: `1px solid ${starCost === n ? 'var(--accent)' : 'var(--border)'}`,
                color: starCost === n ? 'var(--accent)' : 'var(--text)',
              }}
            >⭐ {n}</button>
          ))}
        </div>
        <input
          type="number"
          value={starCost}
          min={1}
          max={500}
          onChange={e => setStarCost(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
          style={{ ...inputStyle, width: 100 }}
        />

        {/* Members */}
        <label style={labelStyle}>Available to</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {members.map(m => {
            const on = memberIds.includes(m.id)
            const isEmoji = m.avatar?.type === 'emoji'
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMember(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px 4px 4px', borderRadius: 20, cursor: 'pointer',
                  background: on ? `${m.color}22` : 'var(--surface2)',
                  border: `1px solid ${on ? m.color + '80' : 'var(--border)'}`,
                  opacity: on ? 1 : 0.5,
                }}
              >
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: m.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: isEmoji ? 11 : 9, fontWeight: 700 }}>
                  {getAvatarContent(m)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: on ? 'var(--text)' : 'var(--text-dim)' }}>{m.name}</span>
              </button>
            )
          })}
        </div>

        {/* Recurring */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Recurring reward</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Can be redeemed multiple times</div>
          </div>
          <button
            type="button"
            onClick={() => setRecurring(v => !v)}
            style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0, background: recurring ? 'var(--accent)' : 'var(--border)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
          >
            <span style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transform: recurring ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s', display: 'block' }} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || memberIds.length === 0 || saving}
          style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: title.trim() && memberIds.length > 0 ? 'pointer' : 'not-allowed', opacity: title.trim() && memberIds.length > 0 ? 1 : 0.5, marginBottom: onDelete ? 10 : 0 }}
        >
          {saving ? 'Saving…' : reward ? 'Save Changes' : 'Create Reward'}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: 'none', border: '1px solid var(--border)', color: '#f87171', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Delete Reward
          </button>
        )}
      </div>
    </div>
  )
}

// ── RedeemModal ───────────────────────────────────────────────────────────

function RedeemModal({
  reward,
  balance,
  onConfirm,
  onClose,
}: {
  reward: Reward
  balance: number
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '28px 24px', maxWidth: 340, width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{reward.emoji || '🎁'}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{reward.title}</div>
        <div style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20 }}>
          Redeem for <strong style={{ color: 'var(--accent)' }}>⭐ {reward.starCost} stars</strong>?<br />
          <span style={{ fontSize: 12 }}>You have {balance} stars. {balance - reward.starCost} will remain.</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Redeem!
          </button>
        </div>
      </div>
    </div>
  )
}

// ── RewardCard ────────────────────────────────────────────────────────────

function RewardCard({
  reward,
  balance,
  memberId,
  onRedeem,
  onEdit,
  celebrating,
}: {
  reward: Reward
  balance: number
  memberId: string
  onRedeem: () => void
  onEdit: () => void
  celebrating: boolean
}) {
  const redeemed = !reward.recurring && (reward.redeemedByMemberIds ?? []).includes(memberId)
  const pct = Math.min(100, Math.round((balance / reward.starCost) * 100))
  const canRedeem = !redeemed && balance >= reward.starCost

  return (
    <div
      style={{
        background: 'var(--surface)', border: `1px solid ${celebrating ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 14, padding: '16px', display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'border-color 0.3s, box-shadow 0.3s',
        boxShadow: celebrating ? '0 0 0 3px var(--accent-glow)' : undefined,
        animation: celebrating ? 'celebratePulse 0.6s ease' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {reward.emoji && <span style={{ fontSize: 26 }}>{reward.emoji}</span>}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{reward.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              ⭐ {reward.starCost} stars{reward.recurring ? ' · recurring' : ''}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
        >
          ✎
        </button>
      </div>

      {!redeemed ? (
        <>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: canRedeem ? 'var(--accent)' : '#6b7280', width: `${pct}%`, transition: 'width 0.4s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {balance} / {reward.starCost} ⭐
            </span>
            <button
              type="button"
              onClick={onRedeem}
              disabled={!canRedeem}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: canRedeem ? 'pointer' : 'not-allowed',
                background: canRedeem ? 'var(--accent)' : 'var(--surface2)',
                border: `1px solid ${canRedeem ? 'var(--accent)' : 'var(--border)'}`,
                color: canRedeem ? '#fff' : 'var(--text-faint)',
                animation: canRedeem ? 'redeemPulse 2s infinite' : undefined,
              }}
            >
              {canRedeem ? '🎉 Redeem!' : `${reward.starCost - balance} more`}
            </button>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, textAlign: 'center', padding: '4px 0' }}>
          ✓ Redeemed
        </div>
      )}
    </div>
  )
}

// ── RewardsTab ────────────────────────────────────────────────────────────

export function RewardsTab() {
  const [members,       setMembers]       = useState<FamilyMember[]>([])
  const [rewards,       setRewards]       = useState<Reward[]>([])
  const [balances,      setBalances]      = useState<Record<string, number>>({})
  const [transactions,  setTransactions]  = useState<StarTransaction[]>([])
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [showHistory,   setShowHistory]   = useState(false)
  const [showForm,      setShowForm]      = useState(false)
  const [editReward,    setEditReward]    = useState<Reward | null>(null)
  const [redeemTarget,  setRedeemTarget]  = useState<Reward | null>(null)
  const [celebrating,   setCelebrating]   = useState<string | null>(null)

  const selectedMember = members.find(m => m.id === selectedId) ?? members[0] ?? null
  const effectiveId    = selectedMember?.id ?? null

  // Load all data
  useEffect(() => {
    async function load() {
      const [membersRes, rewardsRes, balancesRes] = await Promise.all([
        fetch('/api/family'),
        fetch('/api/rewards'),
        fetch('/api/stars'),
      ])
      const [ms, rs, bs] = await Promise.all([
        membersRes.json(),
        rewardsRes.json(),
        balancesRes.json(),
      ])
      const memberList: FamilyMember[] = Array.isArray(ms) ? ms : []
      setMembers(memberList)
      setRewards(Array.isArray(rs) ? rs : [])
      setBalances(typeof bs === 'object' ? bs : {})
      if (!selectedId && memberList.length) setSelectedId(memberList[0].id)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load transactions when member changes
  useEffect(() => {
    if (!effectiveId) return
    fetch(`/api/stars/${effectiveId}`)
      .then(r => r.json())
      .then(d => setTransactions(d.transactions ?? []))
  }, [effectiveId])

  const myBalance = effectiveId ? (balances[effectiveId] ?? 0) : 0
  const myRewards = rewards.filter(r => effectiveId && r.memberIds.includes(effectiveId))

  const handleSaveReward = useCallback(async (data: Omit<Reward, 'id' | 'createdAt' | 'redeemedByMemberIds'>) => {
    if (editReward) {
      const res = await fetch(`/api/rewards/${editReward.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        setRewards(prev => prev.map(r => r.id === updated.id ? updated : r))
      }
    } else {
      const res = await fetch('/api/rewards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) setRewards(prev => [...prev, await res.json()])
    }
    setShowForm(false)
    setEditReward(null)
  }, [editReward])

  const handleDeleteReward = useCallback(async () => {
    if (!editReward) return
    await fetch(`/api/rewards/${editReward.id}`, { method: 'DELETE' })
    setRewards(prev => prev.filter(r => r.id !== editReward.id))
    setShowForm(false)
    setEditReward(null)
  }, [editReward])

  const handleRedeem = useCallback(async () => {
    if (!redeemTarget || !effectiveId) return
    const reward = redeemTarget
    setRedeemTarget(null)

    const res = await fetch(`/api/rewards/${reward.id}/redeem`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: effectiveId }),
    })
    if (!res.ok) return
    const { newBalance } = await res.json()

    setBalances(prev => ({ ...prev, [effectiveId]: newBalance }))
    setRewards(prev => prev.map(r =>
      r.id === reward.id && !reward.recurring
        ? { ...r, redeemedByMemberIds: [...(r.redeemedByMemberIds ?? []), effectiveId] }
        : r
    ))
    setCelebrating(reward.id)
    setTimeout(() => setCelebrating(null), 1200)

    // Refresh transaction history
    fetch(`/api/stars/${effectiveId}`)
      .then(r => r.json())
      .then(d => setTransactions(d.transactions ?? []))
  }, [redeemTarget, effectiveId])

  const rightSlot = (
    <button
      type="button"
      onClick={() => { setEditReward(null); setShowForm(true) }}
      className="flex items-center gap-1 rounded-[8px] text-sm font-semibold text-white border-none cursor-pointer"
      style={{ padding: '6px 14px', background: 'var(--accent)' }}
    >
      + Add Reward
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes celebratePulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @keyframes redeemPulse {
          0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
          50%       { box-shadow: 0 0 0 6px var(--accent-glow); }
        }
      `}</style>

      <InfoBar rightSlot={rightSlot} />

      {/* Profile selector */}
      {members.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', overflowX: 'auto', flexShrink: 0 }}>
          {members.map(m => {
            const on = m.id === effectiveId
            const isEmoji = m.avatar?.type === 'emoji'
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { setSelectedId(m.id); setShowHistory(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                  padding: '6px 14px 6px 8px', borderRadius: 24, cursor: 'pointer',
                  background: on ? `${m.color}22` : 'var(--surface2)',
                  border: `2px solid ${on ? m.color : 'var(--border)'}`,
                }}
              >
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: m.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: isEmoji ? 14 : 11, fontWeight: 700 }}>
                  {getAvatarContent(m)}
                </span>
                <span style={{ fontSize: 14, fontWeight: on ? 700 : 500, color: on ? m.color : 'var(--text-dim)' }}>{m.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: on ? m.color : 'var(--text-faint)' }}>
                  ⭐ {balances[m.id] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: 60 }}>Loading…</div>
        ) : !selectedMember ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: 60 }}>No profiles found</div>
        ) : (
          <>
            {/* Star balance header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 56, lineHeight: 1.1, fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px' }}>
                ⭐ {myBalance}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 4 }}>
                {selectedMember.name}'s stars
              </div>
            </div>

            {/* Rewards grid */}
            {myRewards.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-faint)', marginTop: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎁</div>
                <div style={{ fontSize: 14 }}>No rewards yet — tap + Add Reward</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 24 }}>
                {myRewards.map(r => (
                  <RewardCard
                    key={r.id}
                    reward={r}
                    balance={myBalance}
                    memberId={effectiveId!}
                    celebrating={celebrating === r.id}
                    onRedeem={() => setRedeemTarget(r)}
                    onEdit={() => { setEditReward(r); setShowForm(true) }}
                  />
                ))}
              </div>
            )}

            {/* History toggle */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowHistory(v => !v)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ fontSize: 10 }}>{showHistory ? '▼' : '▶'}</span>
                Star History
              </button>

              {showHistory && (
                <div style={{ marginTop: 12 }}>
                  {transactions.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--text-faint)', padding: '8px 0' }}>No transactions yet</div>
                  ) : (
                    transactions.map(tx => (
                      <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{tx.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{formatTime(tx.timestamp)}</div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: tx.delta > 0 ? '#10b981' : '#f87171' }}>
                          {tx.delta > 0 ? '+' : ''}{tx.delta} ⭐
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <RewardForm
          reward={editReward ?? undefined}
          members={members}
          onSave={handleSaveReward}
          onDelete={editReward ? handleDeleteReward : undefined}
          onClose={() => { setShowForm(false); setEditReward(null) }}
        />
      )}
      {redeemTarget && effectiveId && (
        <RedeemModal
          reward={redeemTarget}
          balance={myBalance}
          onConfirm={handleRedeem}
          onClose={() => setRedeemTarget(null)}
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

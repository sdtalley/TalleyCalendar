'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? 'Login failed')
      }
    } catch {
      setError('Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{ background: 'var(--bg)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-[380px] max-w-[90vw] rounded-2xl p-8 flex flex-col gap-5"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-2">
          <div
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--accent)' }}
          >
            FamilyHub
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
            Sign in to your family calendar
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="px-3 py-2 rounded-lg text-sm text-center"
            style={{
              background: 'rgba(255,107,107,0.1)',
              color: '#ff6b6b',
              border: '1px solid rgba(255,107,107,0.2)',
            }}
          >
            {error}
          </div>
        )}

        {/* Fields */}
        <div className="flex flex-col gap-1.5">
          <label className="field-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="field-label">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-3 rounded-xl text-[15px] font-semibold text-white border-none cursor-pointer transition-all duration-150"
          style={{
            background: 'var(--accent)',
            boxShadow: '0 4px 16px rgba(108,140,255,0.3)',
            opacity: loading || !email || !password ? 0.5 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

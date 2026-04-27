'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ScreensaverSettings } from '@/lib/calendar/types'
import type { DrivePhoto } from '@/app/api/screensaver/photos/route'

interface Props {
  settings: ScreensaverSettings
  suppress?: boolean   // true while recipe detail is open
}

function photoUrl(id: string) {
  return `/api/screensaver/photo/${id}`
}

function formatClock(d: Date) {
  const hours = d.getHours() % 12 || 12
  const mins = String(d.getMinutes()).padStart(2, '0')
  const ampm = d.getHours() < 12 ? 'AM' : 'PM'
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return {
    time: `${hours}:${mins} ${ampm}`,
    date: `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`,
  }
}

export function Screensaver({ settings, suppress = false }: Props) {
  const [active, setActive] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [photos, setPhotos] = useState<DrivePhoto[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [nextIdx, setNextIdx] = useState(1)
  const [transitioning, setTransitioning] = useState(false)
  const [clock, setClock] = useState(() => formatClock(new Date()))
  const blockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const photosRef = useRef<DrivePhoto[]>([])
  photosRef.current = photos

  // ── Idle detection ──────────────────────────────────────────────────────────

  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      if (!suppress) setActive(true)
    }, settings.idleMinutes * 60 * 1000)
  }, [settings.idleMinutes, suppress])

  useEffect(() => {
    if (!settings.enabled) return
    const events = ['touchstart', 'mousemove', 'keydown', 'click', 'scroll'] as const
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }))
    resetIdle()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle))
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [settings.enabled, resetIdle])

  // Dismiss immediately if suppress becomes true while active
  useEffect(() => {
    if (suppress && active) setActive(false)
  }, [suppress, active])

  // ── Photo fetch (on activate) ───────────────────────────────────────────────

  useEffect(() => {
    if (!active || !settings.googleDriveFolderId) return
    fetch('/api/screensaver/photos')
      .then(r => r.json())
      .then(data => {
        let list: DrivePhoto[] = data.photos ?? []
        if (list.length === 0) return

        if (settings.mode === 'single') {
          // Single mode: find pinned photo or fallback to first/random
          if (settings.singlePhotoId) {
            const pinned = list.find(p => p.id === settings.singlePhotoId)
            list = pinned ? [pinned] : [list[0]]
          } else {
            list = [list[0]]
          }
        } else if (settings.order === 'shuffle') {
          // Fisher-Yates shuffle
          for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[list[i], list[j]] = [list[j], list[i]]
          }
        }
        setPhotos(list)
        setCurrentIdx(0)
        setNextIdx(list.length > 1 ? 1 : 0)
      })
      .catch(() => {})
  }, [active, settings.googleDriveFolderId, settings.mode, settings.order, settings.singlePhotoId])

  // ── Slideshow timer ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!active || settings.mode !== 'slideshow' || photos.length <= 1) return
    if (slideTimer.current) clearTimeout(slideTimer.current)

    slideTimer.current = setTimeout(() => {
      setTransitioning(true)
      setTimeout(() => {
        setCurrentIdx(nextIdx)
        const next = (nextIdx + 1) % photosRef.current.length
        setNextIdx(next)
        setTransitioning(false)
      }, 800) // cross-fade duration
    }, settings.secondsPerSlide * 1000)

    return () => { if (slideTimer.current) clearTimeout(slideTimer.current) }
  }, [active, settings.mode, settings.secondsPerSlide, currentIdx, nextIdx, photos.length])

  // Reset slide index when screensaver deactivates
  useEffect(() => {
    if (!active) {
      setPhotos([])
      setCurrentIdx(0)
      setNextIdx(1)
      if (slideTimer.current) clearTimeout(slideTimer.current)
    }
  }, [active])

  // ── Clock tick ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!active || !settings.showDateTime) return
    const tick = setInterval(() => setClock(formatClock(new Date())), 10_000)
    return () => clearInterval(tick)
  }, [active, settings.showDateTime])

  // ── Dismiss on touch ────────────────────────────────────────────────────────

  function dismiss() {
    setActive(false)
    resetIdle()
    setBlocking(true)
    if (blockTimer.current) clearTimeout(blockTimer.current)
    blockTimer.current = setTimeout(() => setBlocking(false), 600)
  }

  // Clean up block timer on unmount
  useEffect(() => () => { if (blockTimer.current) clearTimeout(blockTimer.current) }, [])

  if (blocking) {
    return <div className="fixed inset-0 z-[9999]" style={{ background: 'transparent' }} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} />
  }

  if (!active || !settings.enabled) return null

  const currentPhoto = photos[currentIdx]
  const nextPhoto = photos[nextIdx]
  const objectFit: 'cover' | 'contain' = settings.fill === 'fill' ? 'cover' : 'contain'

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden cursor-pointer"
      style={{ background: '#000' }}
      onPointerDown={dismiss}
    >
      {/* Background blur layer (fit mode only) */}
      {settings.fill === 'fit' && settings.blurBackground && currentPhoto && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${photoUrl(currentPhoto.id)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(24px) brightness(0.4)',
            transform: 'scale(1.05)',
          }}
        />
      )}

      {/* Current photo */}
      {currentPhoto && (
        <img
          key={`cur-${currentPhoto.id}`}
          src={photoUrl(currentPhoto.id)}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full transition-opacity duration-[800ms]"
          style={{
            objectFit,
            opacity: transitioning ? 0 : 1,
          }}
        />
      )}

      {/* Next photo (pre-loaded, fades in during transition) */}
      {nextPhoto && settings.mode === 'slideshow' && photos.length > 1 && (
        <img
          key={`next-${nextPhoto.id}`}
          src={photoUrl(nextPhoto.id)}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full transition-opacity duration-[800ms]"
          style={{
            objectFit,
            opacity: transitioning ? 1 : 0,
          }}
        />
      )}

      {/* DateTime overlay */}
      {settings.showDateTime && (
        <div
          className="absolute bottom-10 left-10 flex flex-col gap-1 select-none"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="text-6xl font-light tracking-tight"
            style={{ color: '#fff', textShadow: '0 2px 16px rgba(0,0,0,0.7)' }}
          >
            {clock.time}
          </div>
          <div
            className="text-xl font-light"
            style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
          >
            {clock.date}
          </div>
        </div>
      )}

      {/* No-folder fallback */}
      {photos.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center flex-col gap-3"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <div className="text-5xl">📷</div>
          <div className="text-lg">No photos configured</div>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Add a Google Drive folder in Settings → Screensaver
          </div>
        </div>
      )}
    </div>
  )
}

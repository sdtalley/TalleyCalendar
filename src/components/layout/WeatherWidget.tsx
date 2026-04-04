'use client'

import { useEffect, useState } from 'react'

interface WeatherData {
  enabled: boolean
  label?: string
  temperature?: number
  humidity?: number
  windSpeed?: number
  description?: string
  icon?: string
  error?: string
}

const WEATHER_ICONS: Record<string, string> = {
  sun: '\u2600\uFE0F',
  'cloud-sun': '\u26C5',
  cloud: '\u2601\uFE0F',
  fog: '\uD83C\uDF2B\uFE0F',
  drizzle: '\uD83C\uDF26\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  snow: '\u2744\uFE0F',
  storm: '\u26C8\uFE0F',
}

export function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null)

  useEffect(() => {
    function fetchWeather() {
      fetch('/api/weather')
        .then(r => r.json())
        .then(setData)
        .catch(() => {})
    }

    fetchWeather()
    const interval = setInterval(fetchWeather, 600_000) // 10 min
    return () => clearInterval(interval)
  }, [])

  if (!data || !data.enabled || data.error) return null

  const icon = data.icon ? WEATHER_ICONS[data.icon] ?? '' : ''

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
      }}
      title={`${data.description} | Humidity ${data.humidity}% | Wind ${data.windSpeed} mph`}
    >
      <span className="text-[18px] leading-none">{icon}</span>
      <div className="flex flex-col">
        <span
          className="text-[14px] font-bold leading-tight"
          style={{ color: 'var(--text)' }}
        >
          {data.temperature}°F
        </span>
        <span
          className="text-[10px] leading-tight"
          style={{ color: 'var(--text-faint)' }}
        >
          {data.label}
        </span>
      </div>
    </div>
  )
}

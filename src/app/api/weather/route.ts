import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/redis'

// GET /api/weather — fetches current weather from Open-Meteo (no API key needed)
export async function GET() {
  const settings = await getSettings()

  if (!settings.weather?.enabled || !settings.weather.latitude || !settings.weather.longitude) {
    return NextResponse.json({ enabled: false })
  }

  const { latitude, longitude, label } = settings.weather

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`

    const res = await fetch(url, { next: { revalidate: 600 } }) // cache 10 min
    if (!res.ok) {
      return NextResponse.json({ enabled: true, error: 'Weather API error' }, { status: 502 })
    }

    const data = await res.json()
    const current = data.current

    return NextResponse.json({
      enabled: true,
      label,
      temperature: Math.round(current.temperature_2m),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      weatherCode: current.weather_code,
      description: weatherCodeToDescription(current.weather_code),
      icon: weatherCodeToIcon(current.weather_code),
    })
  } catch {
    return NextResponse.json({ enabled: true, error: 'Failed to fetch weather' }, { status: 502 })
  }
}

// WMO Weather interpretation codes
// https://open-meteo.com/en/docs#weathervariables
function weatherCodeToDescription(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    56: 'Freezing drizzle',
    57: 'Heavy freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Heavy freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light showers',
    81: 'Showers',
    82: 'Heavy showers',
    85: 'Light snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm w/ hail',
    99: 'Severe thunderstorm',
  }
  return map[code] ?? 'Unknown'
}

function weatherCodeToIcon(code: number): string {
  if (code === 0) return 'sun'
  if (code <= 2) return 'cloud-sun'
  if (code === 3) return 'cloud'
  if (code <= 48) return 'fog'
  if (code <= 57) return 'drizzle'
  if (code <= 67) return 'rain'
  if (code <= 77) return 'snow'
  if (code <= 82) return 'rain'
  if (code <= 86) return 'snow'
  return 'storm'
}

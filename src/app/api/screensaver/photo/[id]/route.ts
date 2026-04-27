import { NextRequest, NextResponse } from 'next/server'

// GET /api/screensaver/photo/[id]
// Proxies a Google Drive file download server-side using GOOGLE_API_KEY.
// Avoids the "confirm before download" redirect Google applies to direct /uc?export=view URLs.
// Sets cache headers so the browser doesn't re-fetch on every slide transition.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return new NextResponse('GOOGLE_API_KEY not configured', { status: 500 })
  }

  const driveUrl =
    `https://www.googleapis.com/drive/v3/files/${params.id}` +
    `?alt=media&key=${apiKey}`

  const res = await fetch(driveUrl)
  if (!res.ok) {
    return new NextResponse('Photo not found', { status: 404 })
  }

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const body = await res.arrayBuffer()

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

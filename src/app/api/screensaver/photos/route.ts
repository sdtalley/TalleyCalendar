import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/redis'

export interface DrivePhoto {
  id: string
  name: string
  createdTime: string
  thumbnailLink?: string
}

// GET /api/screensaver/photos
// Fetches the photo list from the configured Google Drive folder.
// Returns { photos: DrivePhoto[], folderName?: string }
export async function GET() {
  const settings = await getSettings()
  const folderId = settings.screensaver?.googleDriveFolderId
  const apiKey = process.env.GOOGLE_API_KEY

  if (!folderId) {
    return NextResponse.json({ photos: [], folderName: undefined })
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 })
  }

  const url =
    `https://www.googleapis.com/drive/v3/files` +
    `?q=${encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed = false`)}` +
    `&fields=${encodeURIComponent('files(id,name,createdTime,thumbnailLink)')}` +
    `&orderBy=createdTime` +
    `&pageSize=200` +
    `&key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Drive API error: ${text}` }, { status: 502 })
  }

  const data = await res.json()
  const photos: DrivePhoto[] = (data.files ?? []).map((f: DrivePhoto) => ({
    id: f.id,
    name: f.name,
    createdTime: f.createdTime,
    thumbnailLink: f.thumbnailLink,
  }))

  return NextResponse.json({
    photos,
    folderName: settings.screensaver?.googleDriveFolderName,
  })
}

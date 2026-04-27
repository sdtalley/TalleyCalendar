import { NextRequest, NextResponse } from 'next/server'
import { getSettings, updateSettings } from '@/lib/redis'

// POST /api/screensaver/folder
// Body: { folderId: string }
// Validates the folder is accessible via the Drive API, counts photos,
// saves folderId + folderName to screensaver settings.
// Returns { photoCount: number, folderName: string }
export async function POST(req: NextRequest) {
  const { folderId } = await req.json()
  if (!folderId || typeof folderId !== 'string') {
    return NextResponse.json({ error: 'folderId required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 })
  }

  // Fetch folder metadata to get the folder name
  const metaUrl =
    `https://www.googleapis.com/drive/v3/files/${folderId}` +
    `?fields=${encodeURIComponent('id,name')}` +
    `&key=${apiKey}`

  const metaRes = await fetch(metaUrl)
  if (!metaRes.ok) {
    return NextResponse.json(
      { error: 'Folder not found or not publicly shared. Make sure sharing is set to "Anyone with the link → Viewer".' },
      { status: 400 }
    )
  }
  const meta = await metaRes.json()
  const folderName: string = meta.name ?? 'Photos'

  // Count images in the folder
  const listUrl =
    `https://www.googleapis.com/drive/v3/files` +
    `?q=${encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed = false`)}` +
    `&fields=${encodeURIComponent('files(id)')}` +
    `&pageSize=200` +
    `&key=${apiKey}`

  const listRes = await fetch(listUrl)
  const listData = listRes.ok ? await listRes.json() : { files: [] }
  const photoCount: number = (listData.files ?? []).length

  // Merge folder fields into existing screensaver settings (preserve all other settings)
  const current = await getSettings()
  const existing = current.screensaver
  await updateSettings({
    screensaver: {
      enabled: existing?.enabled ?? true,
      idleMinutes: existing?.idleMinutes ?? 3,
      mode: existing?.mode ?? 'slideshow',
      order: existing?.order ?? 'shuffle',
      secondsPerSlide: existing?.secondsPerSlide ?? 30,
      fill: existing?.fill ?? 'fill',
      showDateTime: existing?.showDateTime ?? true,
      blurBackground: existing?.blurBackground ?? false,
      singlePhotoId: existing?.singlePhotoId,
      googleDriveFolderId: folderId,
      googleDriveFolderName: folderName,
    },
  })

  return NextResponse.json({ photoCount, folderName })
}

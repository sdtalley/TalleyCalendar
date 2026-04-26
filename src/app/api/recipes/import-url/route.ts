import { NextRequest, NextResponse } from 'next/server'

// ── JSON-LD helpers ────────────────────────────────────────────────────────

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = []
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    try { blocks.push(JSON.parse(match[1])) } catch { /* skip malformed block */ }
  }
  return blocks
}

function findRecipeSchema(blocks: unknown[]): Record<string, unknown> | null {
  for (const block of blocks) {
    const obj = block as Record<string, unknown>
    if (obj['@type'] === 'Recipe') return obj
    if (Array.isArray(obj['@type']) && (obj['@type'] as string[]).includes('Recipe')) return obj
    if (Array.isArray(obj['@graph'])) {
      for (const item of obj['@graph'] as Record<string, unknown>[]) {
        if (item['@type'] === 'Recipe') return item
        if (Array.isArray(item['@type']) && (item['@type'] as string[]).includes('Recipe')) return item
      }
    }
  }
  return null
}

function parseInstructions(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'string') return raw.trim()
  if (Array.isArray(raw)) {
    return raw
      .map((step: unknown) => {
        if (typeof step === 'string') return step.trim()
        if (typeof step === 'object' && step !== null) {
          const s = step as Record<string, unknown>
          return String(s['text'] ?? '').trim()
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return String(raw).trim()
}

function mapCategory(raw: unknown): string {
  if (!raw) return 'dinner'
  const str = String(Array.isArray(raw) ? raw[0] : raw).toLowerCase()
  if (str.includes('breakfast')) return 'breakfast'
  if (str.includes('lunch') || str.includes('brunch')) return 'lunch'
  if (str.includes('snack') || str.includes('dessert')) return 'snack'
  return 'dinner'
}

// ── Route ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  let html: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-importer/1.0)' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    html = await response.text()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Fetch failed'
    return NextResponse.json({ error: `Could not fetch URL: ${msg}` }, { status: 400 })
  }

  const blocks = extractJsonLdBlocks(html)
  const schema = findRecipeSchema(blocks)

  if (!schema) {
    return NextResponse.json(
      { error: 'No recipe data found on this page. Try entering the recipe manually.' },
      { status: 422 }
    )
  }

  const ingredients = Array.isArray(schema['recipeIngredient'])
    ? (schema['recipeIngredient'] as unknown[]).map(s => String(s).trim()).filter(Boolean)
    : []

  return NextResponse.json({
    name:         String(schema['name'] ?? '').trim(),
    category:     mapCategory(schema['recipeCategory'] ?? schema['recipeType']),
    ingredients,
    instructions: parseInstructions(schema['recipeInstructions']),
    sourceUrl:    url,
  })
}

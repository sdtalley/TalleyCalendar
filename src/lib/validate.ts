import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema, ZodError } from 'zod'

// ── parseBody ──────────────────────────────────────────────────────────────
//
// Validates a Next.js API request body against a Zod schema.
// Returns { data } on success or { error, response } on failure.
//
// Canonical usage (all Phase 3 routes follow this pattern):
//
//   const result = await parseBody(req, MySchema)
//   if (result.error) return result.response
//   const { field1, field2 } = result.data
//
// The 400 response body is { error: string, issues: ZodIssue[] } so clients
// can surface field-level validation errors if needed.

type ParseSuccess<T> = { data: T; error: false }
type ParseFailure = { data: null; error: true; response: NextResponse }

export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<ParseSuccess<T> | ParseFailure> {
  let raw: unknown

  try {
    raw = await req.json()
  } catch {
    return {
      data: null,
      error: true,
      response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    }
  }

  const result = schema.safeParse(raw)

  if (!result.success) {
    return {
      data: null,
      error: true,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          issues: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    }
  }

  return { data: result.data, error: false }
}

// Re-export z so routes only need one import for both schema definition and parsing
export { z } from 'zod'

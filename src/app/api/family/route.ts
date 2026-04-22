import { NextRequest, NextResponse } from 'next/server'
import {
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
} from '@/lib/redis'
import { parseBody, z } from '@/lib/validate'

const PostSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  localOnly: z.boolean().optional(),
  defaultCalendarType: z.enum(['kids', 'shared']).optional(),
})

const PatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  localOnly: z.boolean().optional(),
  defaultCalendarType: z.enum(['kids', 'shared']).optional(),
})

const DeleteSchema = z.object({
  id: z.string().min(1),
})

// GET /api/family — list all family members
export async function GET() {
  const members = await getFamilyMembers()
  return NextResponse.json(members)
}

// POST /api/family — add a family member
export async function POST(req: NextRequest) {
  const result = await parseBody(req, PostSchema)
  if (result.error) return result.response

  const member = {
    id: crypto.randomUUID(),
    ...result.data,
  }

  await addFamilyMember(member)
  return NextResponse.json(member, { status: 201 })
}

// PATCH /api/family — update a family member
export async function PATCH(req: NextRequest) {
  const result = await parseBody(req, PatchSchema)
  if (result.error) return result.response

  const { id, ...updates } = result.data
  const updated = await updateFamilyMember(id, updates)
  if (!updated) {
    return NextResponse.json({ error: 'member not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}

// DELETE /api/family — remove a family member and all their accounts
export async function DELETE(req: NextRequest) {
  const result = await parseBody(req, DeleteSchema)
  if (result.error) return result.response

  const removed = await removeFamilyMember(result.data.id)
  if (!removed) {
    return NextResponse.json({ error: 'member not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

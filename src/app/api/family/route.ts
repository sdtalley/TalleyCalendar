import { NextRequest, NextResponse } from 'next/server'
import {
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
} from '@/lib/redis'
import type { FamilyMember } from '@/lib/calendar/types'

// GET /api/family — list all family members
export async function GET() {
  const members = await getFamilyMembers()
  return NextResponse.json(members)
}

// POST /api/family — add a family member
// Body: { name: string, color: string }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, color } = body

  if (!name || !color) {
    return NextResponse.json({ error: 'name and color are required' }, { status: 400 })
  }

  const member: FamilyMember = {
    id: crypto.randomUUID(),
    name,
    color,
  }

  await addFamilyMember(member)
  return NextResponse.json(member, { status: 201 })
}

// PATCH /api/family — update a family member
// Body: { id: string, name?: string, color?: string }
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updated = await updateFamilyMember(id, updates)
  if (!updated) {
    return NextResponse.json({ error: 'member not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}

// DELETE /api/family — remove a family member and all their accounts
// Body: { id: string }
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const removed = await removeFamilyMember(id)
  if (!removed) {
    return NextResponse.json({ error: 'member not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

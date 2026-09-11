import { NextRequest, NextResponse } from "next/server";
import { deleteRelationship, RelationshipNotFoundError } from "@/lib/server/partnersDb";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteRelationship(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof RelationshipNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to delete relationship." }, { status: 500 });
  }
}

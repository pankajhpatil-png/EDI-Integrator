import { NextRequest, NextResponse } from "next/server";
import { deleteMap, getMap, MapNameConflictError, MapNotFoundError, updateMap } from "@/lib/server/db";
import type { MapSnapshot } from "@/lib/store/mapSnapshot";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, map: await getMap(id) });
  } catch (e) {
    if (e instanceof MapNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to load map." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { name?: string; data?: MapSnapshot };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  try {
    const summary = await updateMap(id, { name: body.name?.trim() || undefined, data: body.data });
    return NextResponse.json({ ok: true, map: summary });
  } catch (e) {
    if (e instanceof MapNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    if (e instanceof MapNameConflictError) return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to update map." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteMap(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof MapNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to delete map." }, { status: 500 });
  }
}

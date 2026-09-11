import { NextRequest, NextResponse } from "next/server";
import { createMap, listMaps, MapNameConflictError } from "@/lib/server/db";
import { EMPTY_SNAPSHOT, type MapSnapshot } from "@/lib/store/mapSnapshot";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, maps: await listMaps() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to list saved maps." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { name?: string; data?: MapSnapshot };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ ok: false, error: "A map name is required." }, { status: 400 });

  try {
    const summary = await createMap(name, { ...EMPTY_SNAPSHOT, ...body.data });
    return NextResponse.json({ ok: true, map: summary });
  } catch (e) {
    if (e instanceof MapNameConflictError) return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to save map." }, { status: 500 });
  }
}

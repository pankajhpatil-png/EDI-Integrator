import { NextRequest, NextResponse } from "next/server";
import { deletePartner, getPartner, PartnerNotFoundError, updatePartner, type PartnerInput } from "@/lib/server/partnersDb";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, partner: await getPartner(id) });
  } catch (e) {
    if (e instanceof PartnerNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to load trading partner." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Partial<PartnerInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  try {
    const partner = await updatePartner(id, body);
    return NextResponse.json({ ok: true, partner });
  } catch (e) {
    if (e instanceof PartnerNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to update trading partner." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deletePartner(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof PartnerNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to delete trading partner." }, { status: 500 });
  }
}

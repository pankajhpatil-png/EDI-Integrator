import { NextRequest, NextResponse } from "next/server";
import { createPartner, listPartners, type PartnerInput, type PartnerRole } from "@/lib/server/partnersDb";

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role") as PartnerRole | null;
  try {
    return NextResponse.json({ ok: true, partners: await listPartners(role ?? undefined) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to list trading partners." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: PartnerInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "A partner name is required." }, { status: 400 });
  if (body.role !== "retailer" && body.role !== "supplier") {
    return NextResponse.json({ ok: false, error: 'role must be "retailer" or "supplier".' }, { status: 400 });
  }

  try {
    const partner = await createPartner({ ...body, name: body.name.trim() });
    return NextResponse.json({ ok: true, partner });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to create trading partner." }, { status: 500 });
  }
}

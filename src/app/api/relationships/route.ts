import { NextRequest, NextResponse } from "next/server";
import { createRelationship, DuplicateRelationshipError, listRelationships } from "@/lib/server/partnersDb";

export async function GET(req: NextRequest) {
  const retailerId = req.nextUrl.searchParams.get("retailerId") ?? undefined;
  const supplierId = req.nextUrl.searchParams.get("supplierId") ?? undefined;
  try {
    return NextResponse.json({ ok: true, relationships: await listRelationships({ retailerId, supplierId }) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to list relationships." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { retailerId?: string; supplierId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!body.retailerId || !body.supplierId) {
    return NextResponse.json({ ok: false, error: "Both retailerId and supplierId are required." }, { status: 400 });
  }

  try {
    const relationship = await createRelationship(body.retailerId, body.supplierId);
    return NextResponse.json({ ok: true, relationship });
  } catch (e) {
    if (e instanceof DuplicateRelationshipError) return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to create relationship." }, { status: 500 });
  }
}

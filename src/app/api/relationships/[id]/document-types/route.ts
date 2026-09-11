import { NextRequest, NextResponse } from "next/server";
import { listDocumentTypes, setDocumentTypes, type DocDirection } from "@/lib/server/partnersDb";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, documentTypes: await listDocumentTypes(id) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to list document types." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { assignments?: { standard: string; transactionCode: string; direction: DocDirection }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  if (!Array.isArray(body.assignments)) {
    return NextResponse.json({ ok: false, error: "assignments must be an array." }, { status: 400 });
  }

  try {
    const documentTypes = await setDocumentTypes(id, body.assignments);
    return NextResponse.json({ ok: true, documentTypes });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to update document types." }, { status: 500 });
  }
}

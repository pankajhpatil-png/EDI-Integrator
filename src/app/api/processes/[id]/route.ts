import { NextRequest, NextResponse } from "next/server";
import { deleteProcess, getProcess, ProcessNameConflictError, ProcessNotFoundError, updateProcess } from "@/lib/server/processesDb";
import type { ProcessDefinition } from "@/lib/orchestration/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, process: await getProcess(id) });
  } catch (e) {
    if (e instanceof ProcessNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to load process." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: { name?: string; definition?: ProcessDefinition };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  try {
    const process = await updateProcess(id, { name: body.name?.trim() || undefined, definition: body.definition });
    return NextResponse.json({ ok: true, process });
  } catch (e) {
    if (e instanceof ProcessNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    if (e instanceof ProcessNameConflictError) return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to update process." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteProcess(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ProcessNotFoundError) return NextResponse.json({ ok: false, error: e.message }, { status: 404 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to delete process." }, { status: 500 });
  }
}

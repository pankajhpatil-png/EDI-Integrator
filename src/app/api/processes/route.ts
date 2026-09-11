import { NextRequest, NextResponse } from "next/server";
import { createProcess, listProcesses, ProcessNameConflictError } from "@/lib/server/processesDb";
import { EMPTY_PROCESS_DEFINITION, type ProcessDefinition } from "@/lib/orchestration/types";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, processes: await listProcesses() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to list processes." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { name?: string; definition?: ProcessDefinition };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ ok: false, error: "A process name is required." }, { status: 400 });

  try {
    const process = await createProcess(name, body.definition ?? EMPTY_PROCESS_DEFINITION);
    return NextResponse.json({ ok: true, process });
  } catch (e) {
    if (e instanceof ProcessNameConflictError) return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to save process." }, { status: 500 });
  }
}

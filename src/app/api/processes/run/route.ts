import { NextRequest, NextResponse } from "next/server";
import { runProcess } from "@/lib/orchestration/runProcess";
import type { ProcessDefinition } from "@/lib/orchestration/types";

// Runs a process definition for real — real FTP connections, real file reads/
// writes — not a preview. Takes the definition inline (rather than by saved-process
// id) so an unsaved in-progress canvas can still be run.
export async function POST(req: NextRequest) {
  let body: { definition?: ProcessDefinition };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }
  if (!body.definition) return NextResponse.json({ ok: false, error: "A process definition is required." }, { status: 400 });

  try {
    const result = await runProcess(body.definition);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to run process." }, { status: 500 });
  }
}

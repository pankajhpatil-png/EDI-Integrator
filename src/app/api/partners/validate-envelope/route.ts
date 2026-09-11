import { NextRequest, NextResponse } from "next/server";
import { findRelationshipByEnvelope } from "@/lib/server/partnersDb";

export async function POST(req: NextRequest) {
  let body: { senderIsaId?: string; receiverIsaId?: string; standard?: string; transactionCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!body.senderIsaId?.trim() || !body.receiverIsaId?.trim()) {
    return NextResponse.json({ ok: false, error: "Both senderIsaId and receiverIsaId are required." }, { status: 400 });
  }

  try {
    const match = await findRelationshipByEnvelope({
      senderIsaId: body.senderIsaId.trim(),
      receiverIsaId: body.receiverIsaId.trim(),
      envelopeStandard: body.standard === "EDIFACT" ? "EDIFACT" : "X12",
      standard: body.standard,
      transactionCode: body.transactionCode,
    });
    return NextResponse.json({ ok: true, match });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to validate envelope." }, { status: 500 });
  }
}

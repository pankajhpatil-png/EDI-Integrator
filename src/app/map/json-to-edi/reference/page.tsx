"use client";

import { useSelectedEdiSchema } from "@/lib/mapping/useSelectedEdiSchema";
import EdiTransactionPicker from "@/components/edi/EdiTransactionPicker";
import SegmentTable from "@/components/edi/SegmentTable";

export default function EdiReferencePage() {
  const { schema } = useSelectedEdiSchema();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          EDI Reference
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Segment and element definitions for the selected transaction set — required vs.
          conditional usage, data types, and max lengths.
        </p>
      </div>

      <EdiTransactionPicker />

      {schema ? (
        <div className="flex flex-col gap-4">
          <SegmentTable title="Header" segments={schema.header} />
          <SegmentTable title={`Body loop — ${schema.bodyLoop.id} (repeating)`} segments={schema.bodyLoop.segments} />
          <SegmentTable title="Trailer" segments={schema.trailer} />
        </div>
      ) : (
        <div
          className="rounded-lg border border-dashed p-6 text-center text-sm"
          style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
        >
          No transaction set selected.
        </div>
      )}
    </div>
  );
}

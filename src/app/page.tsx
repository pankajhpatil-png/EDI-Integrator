import Link from "next/link";

const SCOPE_STATUS: { label: string; status: string; href?: string }[] = [
  { label: "XML Ingestion & Schema Discovery", status: "Built — paste/upload/fetch + structure inference", href: "/map/xml-to-json" },
  { label: "Mapping Workbench (XML → JSON)", status: "Built — drag-connect canvas, ƒx functions, JSON preview", href: "/map/xml-to-json" },
  { label: "EDI Target Modeling (X12/EDIFACT)", status: "Built — segment/element reference browser", href: "/map/json-to-edi/reference" },
  { label: "Mapping Workbench (JSON → EDI)", status: "Built — drag-connect canvas, ƒx functions (string/arithmetic/conditional/chained), constants, lookups", href: "/map/json-to-edi" },
  { label: "JSON Target Modeling", status: "Built — schema-as-you-go field authoring on both mapping canvases" },
  { label: "Transformation Engine", status: "Built — Extended Rules DSL (loop rules + per-field transform chains), EDI preview pipeline" },
  { label: "Validation Engine", status: "Partial — structural + data-level checks for JSON → EDI; XML → JSON has basic loop-array warnings only" },
  { label: "Test & Preview / Regression", status: "Built — sample-payload preview on both stages", href: "/map/json-to-edi" },
  { label: "Mapping Repository & Versioning", status: "Built — named maps saved/loaded from Postgres (Neon), plus local autosave" },
];

export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Overview
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          A schema-agnostic workbench for mapping arbitrary XML into JSON, then JSON into
          compliant X12 or EDIFACT EDI — without writing custom transformation code per
          document type. See <code>BRD/XML_JSON_EDI_Mapping_Tool_BRD_v1.0.docx</code> for full scope.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          V1 scope status
        </span>
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          {SCOPE_STATUS.map((row, i) => (
            <div
              key={row.label}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)", background: "var(--surface)" }}
            >
              <span style={{ color: "var(--ink)" }}>{row.label}</span>
              <div className="flex items-center gap-3">
                <span style={{ color: "var(--ink-muted)" }}>{row.status}</span>
                {row.href && (
                  <Link href={row.href} className="text-xs font-semibold whitespace-nowrap" style={{ color: "var(--accent)" }}>
                    Open →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

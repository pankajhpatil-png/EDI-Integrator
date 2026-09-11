import type { EdiSegmentSchema } from "@/lib/edi/schemaTypes";

export default function SegmentTable({ title, segments }: { title: string; segments: EdiSegmentSchema[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
        {title}
      </span>
      {segments.map((seg) => (
        <div key={seg.tag} className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <div
            className="flex items-center justify-between px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--surface-raised)", color: "var(--ink)" }}
          >
            <span>
              {seg.tag} — {seg.name}
            </span>
            <span className="text-xs font-normal" style={{ color: seg.required ? "var(--danger)" : "var(--ink-muted)" }}>
              {seg.required ? "Mandatory" : "Conditional"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: "var(--ink-muted)" }}>
                  <th className="px-3 py-1 text-left font-medium">Element</th>
                  <th className="px-3 py-1 text-left font-medium">Name</th>
                  <th className="px-3 py-1 text-left font-medium">Type</th>
                  <th className="px-3 py-1 text-left font-medium">Len</th>
                  <th className="px-3 py-1 text-left font-medium">Usage</th>
                </tr>
              </thead>
              <tbody>
                {seg.elements.map((el) => (
                  <tr key={el.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-3 py-1 font-mono" style={{ color: "var(--ink)" }}>
                      {el.id}
                    </td>
                    <td className="px-3 py-1" style={{ color: "var(--ink)" }}>
                      {el.name}
                    </td>
                    <td className="px-3 py-1" style={{ color: "var(--ink-muted)" }}>
                      {el.dataType}
                    </td>
                    <td className="px-3 py-1" style={{ color: "var(--ink-muted)" }}>
                      {el.maxLength ?? "—"}
                    </td>
                    <td className="px-3 py-1" style={{ color: el.required ? "var(--danger)" : "var(--ink-muted)" }}>
                      {el.required ? "Mandatory" : "Conditional"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

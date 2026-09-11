"use client";

import { useState } from "react";
import type { SchemaNode } from "@/lib/schema/types";

function TreeRow({ node, depth }: { node: SchemaNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-1 text-sm" style={{ paddingLeft: depth * 16 + 8 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-4 text-xs"
            style={{ color: "var(--ink-muted)" }}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="font-mono" style={{ color: "var(--ink)" }}>
          {node.label}
        </span>
        {node.kind === "array" && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            repeating
          </span>
        )}
        {node.meta?.xmlNodeType === "attribute" && (
          <span className="text-[10px]" style={{ color: "var(--ink-muted)" }}>
            attr
          </span>
        )}
        {node.kind === "leaf" && node.dataType && (
          <span className="text-[10px] uppercase" style={{ color: "var(--ink-muted)" }}>
            {node.dataType}
          </span>
        )}
        {node.meta?.sample && (
          <span
            className="truncate text-xs italic"
            style={{ color: "var(--ink-muted)", maxWidth: 200 }}
          >
            &ldquo;{node.meta.sample}&rdquo;
          </span>
        )}
        <span className="ml-auto truncate pl-2 font-mono text-[10px]" style={{ color: "var(--ink-muted)" }}>
          {node.path}
        </span>
      </div>
      {open && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SchemaTreeView({ root }: { root: SchemaNode }) {
  return (
    <div className="max-h-[28rem] overflow-y-auto rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <TreeRow node={root} depth={0} />
    </div>
  );
}

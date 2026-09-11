"use client";

import { useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { LeafDataType, SchemaNodeKind } from "@/lib/schema/types";

export interface SchemaRowData extends Record<string, unknown> {
  label: string;
  path: string;
  depth: number;
  kind: SchemaNodeKind;
  dataType?: LeafDataType;
  isArray: boolean;
  isAttribute: boolean;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle: () => void;
  side: "source" | "target";
  editable: boolean;
  onAddField?: () => void;
  onRemoveField?: () => void;
  onRenameField?: (label: string) => void;
  issueSeverity?: "error" | "warning";
  issueMessage?: string;
  hasMapping?: boolean;
  transformSummary?: string;
  transformActive?: boolean;
  onOpenTransform?: () => void;
}

export type SchemaRowNodeType = Node<SchemaRowData, "schemaRow">;

export default function SchemaRowNode({ data }: NodeProps<SchemaRowNodeType>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const isLeaf = data.kind === "leaf";

  return (
    <div
      className="flex items-center gap-1.5 rounded-md border px-2 text-xs"
      style={{
        width: 420,
        height: 32,
        paddingLeft: data.depth * 14 + 8,
        borderColor: "var(--border)",
        background: "var(--surface)",
        color: "var(--ink)",
      }}
      title={data.path}
    >
      {data.side === "target" && isLeaf && (
        <Handle type="target" position={Position.Left} style={{ background: "var(--accent)" }} />
      )}

      {data.hasChildren ? (
        <button
          type="button"
          onClick={data.onToggle}
          className="nodrag nopan w-3 shrink-0"
          style={{ color: "var(--ink-muted)" }}
          aria-label={data.collapsed ? "Expand" : "Collapse"}
        >
          {data.collapsed ? "▸" : "▾"}
        </button>
      ) : (
        <span className="w-3 shrink-0" />
      )}

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft.trim() && draft !== data.label) data.onRenameField?.(draft.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(data.label);
              setEditing(false);
            }
          }}
          className="nodrag nopan min-w-0 flex-1 rounded border px-1 font-mono"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
        />
      ) : (
        <span
          className="nodrag nopan min-w-0 truncate font-mono"
          onDoubleClick={() => data.editable && setEditing(true)}
        >
          {data.label}
        </span>
      )}

      {data.isArray && (
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          repeating
        </span>
      )}
      {data.isAttribute && (
        <span className="shrink-0 text-[9px]" style={{ color: "var(--ink-muted)" }}>
          attr
        </span>
      )}
      {isLeaf && data.dataType && (
        <span className="shrink-0 text-[9px] uppercase" style={{ color: "var(--ink-muted)" }}>
          {data.dataType}
        </span>
      )}

      {(data.issueSeverity || (data.side === "target" && isLeaf)) && (
        <div className={data.editable ? "flex shrink-0 items-center gap-1" : "ml-auto flex shrink-0 items-center gap-1"}>
          {data.issueSeverity && (
            <span title={data.issueMessage} style={{ color: data.issueSeverity === "error" ? "var(--danger)" : "var(--warning)" }}>
              {data.issueSeverity === "error" ? "⛔" : "⚠"}
            </span>
          )}
          {data.side === "target" && isLeaf && (
            <button
              type="button"
              onClick={data.onOpenTransform}
              title={
                data.transformSummary
                  ? `Edit function: ${data.transformSummary}`
                  : data.hasMapping
                    ? "Attach a function to this mapping"
                    : "Connect a constant value or attach a function"
              }
              className="nodrag nopan shrink-0 rounded px-1 py-0.5 text-[10px] font-bold"
              style={{
                color: data.transformSummary ? "var(--accent-ink)" : "var(--ink-muted)",
                background: data.transformActive
                  ? "var(--accent)"
                  : data.transformSummary
                    ? "var(--accent-soft)"
                    : "transparent",
                border: `1px solid ${data.transformSummary ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              ƒx
            </button>
          )}
        </div>
      )}

      {data.editable && (
        <div className="nodrag nopan ml-auto flex shrink-0 items-center gap-1">
          {!isLeaf && (
            <button
              type="button"
              onClick={data.onAddField}
              title="Add field"
              className="nodrag nopan rounded px-1 font-bold"
              style={{ color: "var(--accent)" }}
            >
              +
            </button>
          )}
          {data.depth > 0 && (
            <button
              type="button"
              onClick={data.onRemoveField}
              title="Remove field"
              className="nodrag nopan rounded px-1 font-bold"
              style={{ color: "var(--danger)" }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {data.side === "source" && isLeaf && (
        <Handle type="source" position={Position.Right} style={{ background: "var(--accent)" }} />
      )}
    </div>
  );
}

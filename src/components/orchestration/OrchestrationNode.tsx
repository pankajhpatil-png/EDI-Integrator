"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NODE_TYPE_LABEL, type ProcessNodeType } from "@/lib/orchestration/types";
import NodeIcon from "./nodeIcons";

export interface OrchestrationNodeData extends Record<string, unknown> {
  label: string;
  nodeType: ProcessNodeType;
  summary: string;
  selected: boolean;
  onSelect: () => void;
}

export type OrchestrationNodeReactFlowType = Node<OrchestrationNodeData, "orchestrationNode">;

export default function OrchestrationNode({ data }: NodeProps<OrchestrationNodeReactFlowType>) {
  const isStart = data.nodeType === "start";
  const isEnd = data.nodeType === "end";

  return (
    <div
      onClick={data.onSelect}
      className="cursor-pointer rounded-lg border px-2.5 py-2 text-xs shadow-sm"
      style={{
        width: 176,
        borderColor: data.selected ? "var(--accent)" : "var(--border)",
        borderWidth: data.selected ? 2 : 1,
        background: isStart || isEnd ? "var(--surface-raised)" : "var(--surface)",
      }}
    >
      {!isStart && <Handle type="target" position={Position.Left} style={{ background: "var(--accent)" }} />}
      <div className="flex items-center gap-2">
        <div
          className="flex shrink-0 items-center justify-center rounded-full"
          style={{ width: 28, height: 28, background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <NodeIcon type={data.nodeType} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold" style={{ color: "var(--ink)" }}>
            {data.label}
          </div>
          {!isStart && !isEnd && (
            <div className="truncate text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              {NODE_TYPE_LABEL[data.nodeType]}
            </div>
          )}
        </div>
      </div>
      {!isStart && !isEnd && (
        <div className="mt-1 truncate pl-[36px] text-[10px]" style={{ color: data.summary === "Not configured" ? "var(--warning)" : "var(--ink-muted)" }}>
          {data.summary}
        </div>
      )}
      {!isEnd && <Handle type="source" position={Position.Right} style={{ background: "var(--accent)" }} />}
    </div>
  );
}

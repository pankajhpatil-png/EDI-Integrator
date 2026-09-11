"use client";

import { useCallback, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ReactFlow, Background, type Connection, type Edge } from "@xyflow/react";
import type { SchemaNode } from "@/lib/schema/types";
import { transformSummary, type MappingEdge } from "@/lib/mapping/types";
import type { ValidationIssue } from "@/lib/validation/types";
import SchemaRowNode, { type SchemaRowNodeType } from "./SchemaRowNode";

const ROW_HEIGHT = 36;
const SOURCE_X = 24;
const TARGET_X = 520;
const MAX_HEIGHT = 560;

const nodeTypes = { schemaRow: SchemaRowNode };

// React Flow sets `pointer-events: none` on a node's wrapper div unless the node is
// selectable/draggable or an onNodeClick handler is registered — our rows are neither
// selectable nor draggable, so without this no-op handler every click inside a row
// (the +/x/collapse buttons) would be silently swallowed at the CSS level.
function NOOP_NODE_CLICK() {}

interface VisibleRow {
  node: SchemaNode;
  depth: number;
}

function flattenVisible(root: SchemaNode, collapsed: Set<string>): VisibleRow[] {
  const rows: VisibleRow[] = [];
  function walk(node: SchemaNode, depth: number) {
    rows.push({ node, depth });
    if (collapsed.has(node.id)) return;
    for (const child of node.children ?? []) walk(child, depth + 1);
  }
  walk(root, 0);
  return rows;
}

export interface MappingCanvasProps {
  sourceRoot: SchemaNode;
  targetRoot: SchemaNode;
  mappings: MappingEdge[];
  onConnect: (sourceNodeId: string, targetNodeId: string) => void;
  onRemoveMapping: (edgeId: string) => void;
  onAddField?: (parentId: string) => void;
  onRemoveField?: (nodeId: string) => void;
  onRenameField?: (nodeId: string, label: string) => void;
  // Which side gets the +/×/rename schema-as-you-go controls — "source" (default)
  // fits JSON -> EDI (the JSON tree being authored is the source); "target" fits
  // XML -> JSON (the XML tree is read-only/inferred, the JSON tree being authored
  // is the target).
  editableSide?: "source" | "target";
  onOpenTransform?: (targetNodeId: string) => void;
  activeTransformTargetId?: string | null;
  issues?: ValidationIssue[];
}

export default function MappingCanvas({
  sourceRoot,
  targetRoot,
  mappings,
  onConnect,
  onRemoveMapping,
  onAddField,
  onRemoveField,
  onRenameField,
  editableSide = "source",
  onOpenTransform,
  activeTransformTargetId,
  issues,
}: MappingCanvasProps) {
  const [collapsedSource, setCollapsedSource] = useState<Set<string>>(new Set());
  const [collapsedTarget, setCollapsedTarget] = useState<Set<string>>(new Set());

  const sourceRows = useMemo(() => flattenVisible(sourceRoot, collapsedSource), [sourceRoot, collapsedSource]);
  const targetRows = useMemo(() => flattenVisible(targetRoot, collapsedTarget), [targetRoot, collapsedTarget]);

  const sourceEditable = Boolean(onAddField) && editableSide === "source";
  const targetEditable = Boolean(onAddField) && editableSide === "target";

  const issuesByTargetId = useMemo(() => {
    const map = new Map<string, { severity: "error" | "warning"; messages: string[] }>();
    for (const issue of issues ?? []) {
      if (!issue.targetNodeId) continue;
      const existing = map.get(issue.targetNodeId);
      if (existing) {
        existing.messages.push(issue.message);
        if (issue.severity === "error") existing.severity = "error";
      } else {
        map.set(issue.targetNodeId, { severity: issue.severity, messages: [issue.message] });
      }
    }
    return map;
  }, [issues]);

  const mappingByTargetId = useMemo(() => {
    const map = new Map<string, MappingEdge>();
    for (const m of mappings) map.set(m.targetNodeId, m);
    return map;
  }, [mappings]);

  const nodes: SchemaRowNodeType[] = useMemo(() => {
    const sourceNodes: SchemaRowNodeType[] = sourceRows.map(({ node, depth }, i) => ({
      id: `src:${node.id}`,
      type: "schemaRow",
      position: { x: SOURCE_X, y: i * ROW_HEIGHT },
      draggable: false,
      selectable: false,
      connectable: node.kind === "leaf",
      data: {
        label: node.label,
        path: node.path,
        depth,
        kind: node.kind,
        dataType: node.dataType,
        isArray: node.kind === "array",
        isAttribute: node.meta?.xmlNodeType === "attribute",
        hasChildren: (node.children?.length ?? 0) > 0,
        collapsed: collapsedSource.has(node.id),
        onToggle: () =>
          setCollapsedSource((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
          }),
        side: "source",
        editable: sourceEditable,
        onAddField: () => onAddField?.(node.id),
        onRemoveField: () => onRemoveField?.(node.id),
        onRenameField: (label: string) => onRenameField?.(node.id, label),
      },
    }));

    const targetNodes: SchemaRowNodeType[] = targetRows.map(({ node, depth }, i) => ({
      id: `tgt:${node.id}`,
      type: "schemaRow",
      position: { x: TARGET_X, y: i * ROW_HEIGHT },
      draggable: false,
      selectable: false,
      connectable: node.kind === "leaf",
      data: {
        label: node.label,
        path: node.path,
        depth,
        kind: node.kind,
        dataType: node.dataType,
        isArray: node.kind === "array",
        isAttribute: false,
        hasChildren: (node.children?.length ?? 0) > 0,
        collapsed: collapsedTarget.has(node.id),
        onToggle: () =>
          setCollapsedTarget((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
          }),
        side: "target",
        editable: targetEditable,
        onAddField: () => onAddField?.(node.id),
        onRemoveField: () => onRemoveField?.(node.id),
        onRenameField: (label: string) => onRenameField?.(node.id, label),
        issueSeverity: issuesByTargetId.get(node.id)?.severity,
        issueMessage: issuesByTargetId.get(node.id)?.messages.join("\n"),
        hasMapping: node.kind === "leaf" && mappingByTargetId.has(node.id),
        transformSummary: mappingByTargetId.get(node.id)?.transform ? transformSummary(mappingByTargetId.get(node.id)!.transform!) : undefined,
        transformActive: activeTransformTargetId === node.id,
        onOpenTransform: () => onOpenTransform?.(node.id),
      },
    }));

    return [...sourceNodes, ...targetNodes];
  }, [
    sourceRows,
    targetRows,
    collapsedSource,
    collapsedTarget,
    sourceEditable,
    targetEditable,
    onAddField,
    onRemoveField,
    onRenameField,
    onOpenTransform,
    activeTransformTargetId,
    issuesByTargetId,
    mappingByTargetId,
  ]);

  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  const edges: Edge[] = useMemo(
    () =>
      mappings
        .filter((m) => nodeIds.has(`src:${m.sourceNodeId}`) && nodeIds.has(`tgt:${m.targetNodeId}`))
        .map((m) => ({
          id: m.id,
          source: `src:${m.sourceNodeId}`,
          target: `tgt:${m.targetNodeId}`,
          label: m.transform ? "ƒx" : undefined,
          style: { stroke: "var(--accent)", strokeWidth: 2, strokeDasharray: m.transform ? "4 3" : undefined },
        })),
    [mappings, nodeIds]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      onConnect(connection.source.slice(4), connection.target.slice(4));
    },
    [onConnect]
  );

  const handleEdgeClick = useCallback(
    (_event: ReactMouseEvent, edge: Edge) => onRemoveMapping(edge.id),
    [onRemoveMapping]
  );

  const height = Math.min(Math.max(sourceRows.length, targetRows.length, 6) * ROW_HEIGHT + 40, MAX_HEIGHT);

  return (
    <div
      style={{ height, width: "100%", borderColor: "var(--border)", background: "var(--bg)" }}
      className="overflow-hidden rounded-lg border"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onNodeClick={NOOP_NODE_CLICK}
        nodesDraggable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      >
        <Background gap={16} />
      </ReactFlow>
    </div>
  );
}

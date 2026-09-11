"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, applyNodeChanges, useReactFlow, type Connection, type Edge, type NodeChange } from "@xyflow/react";
import { NODE_DRAG_MIME, type ProcessDefinition, type ProcessNode, type ProcessNodeType } from "@/lib/orchestration/types";
import OrchestrationNode, { type OrchestrationNodeReactFlowType } from "./OrchestrationNode";

const nodeTypes = { orchestrationNode: OrchestrationNode };
const HEIGHT = 420;
// Matches OrchestrationNode's own fixed width and a generous estimate of its tallest
// (non-start/end) rendered height — used to compute fit bounds ourselves rather than
// waiting on React Flow's internal per-node ResizeObserver measurement, which can
// still report stale/zero dimensions for a node added moments ago.
const NODE_WIDTH = 176;
const NODE_HEIGHT = 80;

function summarize(node: ProcessNode): string {
  switch (node.config.type) {
    case "start":
    case "end":
    case "tradingPartner":
      return "";
    case "input": {
      const s = node.config.source;
      if (!s) return "Not configured";
      return s.kind === "ftp" ? `FTP: ${s.ftp.host || "?"}` : `Folder: ${s.folder.path || "?"}`;
    }
    case "output": {
      const d = node.config.destination;
      if (!d) return "Not configured";
      return d.kind === "ftp" ? `FTP: ${d.ftp.host || "?"}` : `Folder: ${d.folder.path || "?"}`;
    }
    case "map":
      return node.config.map.mapId ? "Map selected" : "Not configured";
    case "script":
      return "Runtime TBD (no-op)";
  }
}

export interface OrchestrationCanvasProps {
  definition: ProcessDefinition;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onDefinitionChange: (definition: ProcessDefinition) => void;
  // Called when a palette item is dropped onto the canvas, with the drop point
  // already converted to flow (canvas) coordinates — the page owns id generation
  // and default config, this component only owns the drag/drop mechanics.
  onDropNode: (type: ProcessNodeType, position: { x: number; y: number }) => void;
}

function Flow({ definition, selectedNodeId, onSelectNode, onDefinitionChange, onDropNode }: OrchestrationCanvasProps) {
  const { screenToFlowPosition, fitBounds } = useReactFlow();

  // The ReactFlow `fitView` prop only fits once, on mount, and even called manually
  // it relies on React Flow having already measured each node's real DOM size via
  // ResizeObserver — which can still be pending for a node added moments ago,
  // making fitView silently no-op or under-fit right after an add/drop. Compute the
  // bounding box ourselves from data we already control (position + our own fixed
  // node width/height) and fit to that explicitly instead — no dependency on
  // React Flow's internal measurement timing at all.
  const nodeIdsKey = definition.nodes.map((n) => n.id).join(",");
  useEffect(() => {
    if (definition.nodes.length === 0) return;
    const xs = definition.nodes.map((n) => n.position.x);
    const ys = definition.nodes.map((n) => n.position.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const bounds = { x: minX, y: minY, width: Math.max(...xs) + NODE_WIDTH - minX, height: Math.max(...ys) + NODE_HEIGHT - minY };
    const timer = setTimeout(() => {
      fitBounds(bounds, { padding: 0.3, duration: 200 });
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the node-id SET changes; bounds are recomputed from current positions each time regardless
  }, [nodeIdsKey, fitBounds]);

  // React Flow keeps a node's DOM wrapper at `visibility: hidden` until it has
  // measured that node's real rendered size (via ResizeObserver) — this is
  // reported back to us as a "dimensions" NodeChange through onNodesChange, which
  // applyNodeChanges folds into a `measured: {width, height}` field. Our `nodes`
  // array is rebuilt fresh from `definition.nodes` on every render (a deliberately
  // minimal, persistable data model — position/config only, nothing render-only),
  // so without remembering `measured` here ourselves, every rebuild — including
  // the one immediately triggered by that very dimensions change — hands React
  // Flow a node object with no `measured` field again, so it never considers the
  // node measured and it stays invisible forever. Confirmed via a real headless-
  // browser DOM inspection (not guessed): nodes had correct transforms/positions
  // but a permanent inline `visibility: hidden`. Stored as state (not a ref) so the
  // `nodes` memo below can read it during render without tripping react-hooks/refs —
  // refs must only be read in effects/handlers, not render.
  const [measuredById, setMeasuredById] = useState<Map<string, { width?: number; height?: number }>>(new Map());

  const nodes: OrchestrationNodeReactFlowType[] = useMemo(
    () =>
      definition.nodes.map((n) => ({
        id: n.id,
        type: "orchestrationNode",
        position: n.position,
        measured: measuredById.get(n.id),
        selectable: false,
        data: {
          label: n.label,
          nodeType: n.config.type,
          summary: summarize(n),
          selected: n.id === selectedNodeId,
          onSelect: () => onSelectNode(n.id),
        },
      })),
    [definition.nodes, selectedNodeId, onSelectNode, measuredById]
  );

  const edges: Edge[] = useMemo(
    () => definition.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, style: { stroke: "var(--accent)", strokeWidth: 2 } })),
    [definition.edges]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, nodes);
      setMeasuredById((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const n of updated) {
          if (n.measured && (n.measured.width !== prev.get(n.id)?.width || n.measured.height !== prev.get(n.id)?.height)) {
            next.set(n.id, n.measured);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      const positionById = new Map(updated.map((n) => [n.id, n.position]));
      onDefinitionChange({
        ...definition,
        nodes: definition.nodes.map((n) => ({ ...n, position: positionById.get(n.id) ?? n.position })),
      });
    },
    [nodes, definition, onDefinitionChange]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      // one outgoing edge per source, matching the linear-chain execution model
      const withoutSameSource = definition.edges.filter((e) => e.source !== connection.source);
      onDefinitionChange({
        ...definition,
        edges: [...withoutSameSource, { id: `${connection.source}=>${connection.target}`, source: connection.source, target: connection.target }],
      });
    },
    [definition, onDefinitionChange]
  );

  const handleEdgeClick = useCallback(
    (_event: ReactMouseEvent, edge: Edge) => {
      onDefinitionChange({ ...definition, edges: definition.edges.filter((e) => e.id !== edge.id) });
    },
    [definition, onDefinitionChange]
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(NODE_DRAG_MIME) as ProcessNodeType | "";
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onDropNode(type, position);
    },
    [screenToFlowPosition, onDropNode]
  );

  return (
    <div
      style={{ height: HEIGHT, width: "100%", borderColor: "var(--border)", background: "var(--bg)" }}
      className="overflow-hidden rounded-lg border"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        elementsSelectable
        panOnScroll
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function OrchestrationCanvas(props: OrchestrationCanvasProps) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}

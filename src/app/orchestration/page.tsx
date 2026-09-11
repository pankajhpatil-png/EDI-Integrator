"use client";

import { useRef, useState, type DragEvent } from "react";
import OrchestrationCanvas from "@/components/orchestration/OrchestrationCanvas";
import NodeConfigPanel from "@/components/orchestration/NodeConfigPanel";
import NodeIcon from "@/components/orchestration/nodeIcons";
import {
  createProcess,
  deleteProcess,
  getProcess,
  listProcesses,
  runProcessRemote,
  updateProcess,
  type ProcessSummary,
  type RunResult,
} from "@/lib/orchestration/processesApi";
import { defaultConfigFor, EMPTY_PROCESS_DEFINITION, NODE_DRAG_MIME, NODE_TYPE_LABEL, type ProcessDefinition, type ProcessNodeConfig, type ProcessNodeType } from "@/lib/orchestration/types";

const ADDABLE_TYPES: ProcessNodeType[] = ["input", "tradingPartner", "map", "script", "output"];

function newNodeId(definition: ProcessDefinition): string {
  let n = definition.nodes.length + 1;
  while (definition.nodes.some((node) => node.id === `node${n}`)) n++;
  return `node${n}`;
}

export default function OrchestrationPage() {
  const [definition, setDefinition] = useState<ProcessDefinition>(EMPTY_PROCESS_DEFINITION);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [currentProcessName, setCurrentProcessName] = useState<string | null>(null);

  const [namingOpen, setNamingOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [loadOpen, setLoadOpen] = useState(false);
  const [savedProcesses, setSavedProcesses] = useState<ProcessSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const completionNameRef = useRef("");

  const selectedNode = definition.nodes.find((n) => n.id === selectedNodeId) ?? null;

  function addNode(type: ProcessNodeType, position?: { x: number; y: number }) {
    const id = newNodeId(definition);
    const index = definition.nodes.length;
    const resolvedPosition = position ?? { x: 120 + index * 40, y: 220 + (index % 3) * 90 };
    setDefinition((prev) => ({
      ...prev,
      nodes: [...prev.nodes, { id, label: NODE_TYPE_LABEL[type], position: resolvedPosition, config: defaultConfigFor(type) }],
    }));
    setSelectedNodeId(id);
  }

  function handlePaletteDragStart(event: DragEvent, type: ProcessNodeType) {
    event.dataTransfer.setData(NODE_DRAG_MIME, type);
    event.dataTransfer.effectAllowed = "move";
  }

  function updateNodeConfig(config: ProcessNodeConfig) {
    if (!selectedNodeId) return;
    setDefinition((prev) => ({ ...prev, nodes: prev.nodes.map((n) => (n.id === selectedNodeId ? { ...n, config } : n)) }));
  }

  function renameNode(label: string) {
    if (!selectedNodeId) return;
    setDefinition((prev) => ({ ...prev, nodes: prev.nodes.map((n) => (n.id === selectedNodeId ? { ...n, label } : n)) }));
  }

  function removeNode() {
    if (!selectedNodeId) return;
    setDefinition((prev) => ({
      nodes: prev.nodes.filter((n) => n.id !== selectedNodeId),
      edges: prev.edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
    }));
    setSelectedNodeId(null);
  }

  async function refreshList() {
    setListError(null);
    try {
      const { processes } = await listProcesses();
      setSavedProcesses(processes);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to list saved processes.");
    }
  }

  function openLoad() {
    setNamingOpen(false);
    setLoadOpen((v) => !v);
    if (!loadOpen) refreshList();
  }

  async function saveUnderName(name: string) {
    setBusy(true);
    setSaveError(null);
    try {
      const { process } = currentProcessId ? await updateProcess(currentProcessId, { name, definition }) : await createProcess(name, definition);
      setCurrentProcessId(process.id);
      setCurrentProcessName(process.name);
      setNamingOpen(false);
      setCompletionDismissed(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  function handleSaveClick() {
    setSaveError(null);
    if (currentProcessName) saveUnderName(currentProcessName);
    else {
      setNameDraft("");
      setNamingOpen(true);
    }
  }

  async function handleLoad(id: string) {
    if (!window.confirm("Load this process? The current canvas will be replaced.")) return;
    setBusy(true);
    try {
      const { process } = await getProcess(id);
      setDefinition(process.definition);
      setCurrentProcessId(process.id);
      setCurrentProcessName(process.name);
      setSelectedNodeId(null);
      setRunResult(null);
      setLoadOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to load process.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this saved process? This can't be undone.")) return;
    try {
      await deleteProcess(id);
      if (id === currentProcessId) {
        setCurrentProcessId(null);
        setCurrentProcessName(null);
      }
      await refreshList();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to delete process.");
    }
  }

  function handleNew() {
    if (!window.confirm("Start a new process? Unsaved changes will be lost.")) return;
    setDefinition(EMPTY_PROCESS_DEFINITION);
    setCurrentProcessId(null);
    setCurrentProcessName(null);
    setSelectedNodeId(null);
    setRunResult(null);
    setCompletionDismissed(false);
  }

  async function handleRun() {
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const { result } = await runProcessRemote(definition);
      setRunResult(result);
      if (result.success) setCompletionDismissed(false);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Failed to run process.");
    } finally {
      setRunning(false);
    }
  }

  const showCompletionPrompt = runResult?.success && !currentProcessName && !completionDismissed;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
            Orchestration Canvas
          </h1>
          <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
            Compose an end-to-end integration flow — Input, Trading Partner lookup, Map, optional
            Script, Output — wired left to right. <b>Run</b> actually connects to the configured
            FTP servers/folders and executes the flow for real.
          </p>
        </div>
        <div className="relative flex shrink-0 items-center gap-1.5 text-sm">
          <span className="hidden max-w-[160px] truncate font-medium sm:inline" style={{ color: "var(--ink-muted)" }}>
            {currentProcessName ?? "Unsaved process"}
          </span>
          <button type="button" onClick={handleSaveClick} disabled={busy} className="rounded-md border px-2 py-1 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--ink)" }}>
            Save
          </button>
          <button type="button" onClick={openLoad} disabled={busy} className="rounded-md border px-2 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>
            Load ▾
          </button>
          <button type="button" onClick={handleNew} disabled={busy} className="rounded-md border px-2 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>
            New
          </button>

          {namingOpen && (
            <div className="absolute right-0 top-full z-10 mt-2 flex w-64 flex-col gap-2 rounded-lg border p-3 shadow-lg" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                Name this process
              </span>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && nameDraft.trim() && saveUnderName(nameDraft.trim())}
                placeholder="e.g. Acme PO inbound"
                className="rounded-md border px-2 py-1 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!nameDraft.trim() || busy}
                  onClick={() => saveUnderName(nameDraft.trim())}
                  className="rounded-md px-3 py-1 text-xs font-semibold"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: !nameDraft.trim() || busy ? 0.6 : 1 }}
                >
                  Save
                </button>
                <button type="button" onClick={() => setNamingOpen(false)} className="rounded-md border px-3 py-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loadOpen && (
            <div className="absolute right-0 top-full z-10 mt-2 flex w-80 flex-col gap-2 rounded-lg border p-3 shadow-lg" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                Saved processes
              </span>
              {listError && <div className="text-xs" style={{ color: "var(--danger)" }}>{listError}</div>}
              {!savedProcesses && !listError && <span className="text-xs" style={{ color: "var(--ink-muted)" }}>Loading…</span>}
              {savedProcesses?.length === 0 && <span className="text-xs" style={{ color: "var(--ink-muted)" }}>No saved processes yet.</span>}
              {savedProcesses && savedProcesses.length > 0 && (
                <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {savedProcesses.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs" style={{ background: "var(--surface)" }}>
                      <button type="button" onClick={() => handleLoad(p.id)} className="min-w-0 flex-1 truncate text-left font-medium" style={{ color: "var(--ink)" }}>
                        {p.name}
                      </button>
                      <button type="button" onClick={() => handleDelete(p.id)} className="shrink-0 rounded px-1 font-bold" style={{ color: "var(--danger)" }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}>
          {saveError}
        </div>
      )}

      {showCompletionPrompt && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
          <span className="flex-1" style={{ color: "var(--ink)" }}>
            The run completed successfully — give this process a name to save it.
          </span>
          <input
            autoFocus
            onChange={(e) => (completionNameRef.current = e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && completionNameRef.current.trim() && saveUnderName(completionNameRef.current.trim())}
            placeholder="e.g. Acme PO inbound"
            className="min-w-[180px] flex-1 rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
          />
          <button
            type="button"
            onClick={() => completionNameRef.current.trim() && saveUnderName(completionNameRef.current.trim())}
            className="shrink-0 rounded-md px-3 py-1 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Save
          </button>
          <button type="button" onClick={() => setCompletionDismissed(true)} className="shrink-0 rounded px-1 font-bold" style={{ color: "var(--ink-muted)" }}>
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          Components — drag onto the canvas (or click to add):
        </span>
        {ADDABLE_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            draggable
            onDragStart={(e) => handlePaletteDragStart(e, t)}
            onClick={() => addNode(t)}
            className="flex cursor-grab items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium active:cursor-grabbing"
            style={{ borderColor: "var(--border)", color: "var(--ink)", background: "var(--surface)" }}
          >
            <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: 20, height: 20, background: "var(--accent-soft)", color: "var(--accent)" }}>
              <NodeIcon type={t} size={13} />
            </span>
            {NODE_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <OrchestrationCanvas
          definition={definition}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onDefinitionChange={setDefinition}
          onDropNode={(type, position) => addNode(type, position)}
        />
        <div className="flex flex-col gap-3">
          <NodeConfigPanel node={selectedNode} onChange={updateNodeConfig} onRename={renameNode} onRemove={removeNode} />

          <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              Layers ({definition.nodes.length})
            </span>
            <div className="mt-2 flex flex-col gap-1">
              {definition.nodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedNodeId(n.id)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs"
                  style={{ background: n.id === selectedNodeId ? "var(--accent-soft)" : "transparent", color: n.id === selectedNodeId ? "var(--accent)" : "var(--ink)" }}
                >
                  <NodeIcon type={n.config.type} size={13} />
                  {n.label} <span style={{ color: "var(--ink-muted)" }}>· {NODE_TYPE_LABEL[n.config.type]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            Run
          </span>
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: running ? 0.6 : 1 }}
          >
            {running ? "Running…" : "Run process"}
          </button>
        </div>

        {runError && (
          <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}>
            {runError}
          </div>
        )}

        {runResult && (
          <div className="flex flex-col gap-2">
            <span style={{ color: runResult.success ? "var(--ink)" : "var(--danger)" }}>
              {runResult.success ? "✓ Run completed successfully." : "⛔ Run failed."}
            </span>
            <ol className="flex flex-col gap-1 text-xs">
              {runResult.steps.map((step, i) => (
                <li
                  key={i}
                  className="rounded-md border px-3 py-2"
                  style={{
                    borderColor: "var(--border)",
                    background: step.status === "error" ? "var(--danger-soft)" : step.status === "skipped" ? "var(--surface)" : "var(--surface-raised)",
                    color: step.status === "error" ? "var(--danger)" : "var(--ink)",
                  }}
                >
                  <span className="font-semibold">
                    {step.status === "ok" ? "✓" : step.status === "error" ? "⛔" : "—"} {step.label}
                  </span>
                  <span className="ml-1" style={{ color: step.status === "error" ? "var(--danger)" : "var(--ink-muted)" }}>
                    {step.message}
                  </span>
                </li>
              ))}
            </ol>
            {runResult.outputText && (
              <pre
                className="overflow-x-auto rounded-lg border p-3 font-mono text-xs whitespace-pre-wrap"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
              >
                {runResult.outputText}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { addChild, collectIds, findNode, removeNode, renameNode, type AddChildInput } from "@/lib/schema/treeOps";
import type { LeafDataType, SchemaNode } from "@/lib/schema/types";
import {
  appendTransformStep,
  pruneMappingsForRemovedIds,
  removeMapping,
  removeTransformStep,
  setMappingTransform,
  upsertConstantMapping,
  upsertMapping,
  type MappingTransformStep,
} from "@/lib/mapping/types";
import { validateMapping } from "@/lib/validation/validateMapping";
import { inferSchemaFromJson, JsonParseError } from "@/lib/json/inferSchema";
import { generateEdiPreview, type EdiPreviewResult } from "@/lib/mapping/generateEdiPreview";
import { useSelectedEdiSchema } from "@/lib/mapping/useSelectedEdiSchema";
import { useAppState } from "@/lib/store/AppStateContext";
import MappingCanvas from "@/components/mapping/MappingCanvas";
import TransformPanel from "@/components/mapping/TransformPanel";
import ApiFetchPanel from "@/components/api/ApiFetchPanel";
import EdiTransactionPicker from "@/components/edi/EdiTransactionPicker";
import MapCompletionPrompt from "@/components/maps/MapCompletionPrompt";

const FIELD_TYPES: (LeafDataType | "object" | "array")[] = ["string", "number", "date", "boolean", "object", "array"];

function emptyJsonRoot(): SchemaNode {
  return { id: "root", label: "json", path: "root", kind: "object", children: [], meta: { source: "json" } };
}

export default function JsonToEdiPage() {
  const {
    targetJsonTree,
    setTargetJsonTree,
    jsonToEdiMappings,
    setJsonToEdiMappings,
    nodeRules,
    setNodeRules,
    sampleJsonText,
    setSampleJsonText,
    globalVarDecls,
  } = useAppState();
  const { schema, targetRoot } = useSelectedEdiSchema();

  const samplePayload = useMemo(() => {
    try {
      return JSON.parse(sampleJsonText || "{}");
    } catch {
      return null;
    }
  }, [sampleJsonText]);

  const validationIssues =
    schema && targetJsonTree ? validateMapping(schema, targetJsonTree, jsonToEdiMappings) : [];
  const isMappingComplete = validationIssues.length === 0 && jsonToEdiMappings.length > 0;

  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<AddChildInput["type"]>("string");

  const [importJsonText, setImportJsonText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [transformTargetId, setTransformTargetId] = useState<string | null>(null);
  const transformMapping = jsonToEdiMappings.find((m) => m.targetNodeId === transformTargetId);

  const [previewResult, setPreviewResult] = useState<EdiPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const sampleFileInputRef = useRef<HTMLInputElement>(null);

  const loopNodeId = schema ? `root.${schema.bodyLoop.id}[]` : null;
  const loopRules = loopNodeId ? nodeRules[loopNodeId] : undefined;

  useEffect(() => {
    if (!targetJsonTree) setTargetJsonTree(emptyJsonRoot());
  }, [targetJsonTree, setTargetJsonTree]);

  function handleConnect(sourceNodeId: string, targetNodeId: string) {
    setJsonToEdiMappings((prev) => upsertMapping(prev, sourceNodeId, targetNodeId));
  }

  function handleRemoveMapping(edgeId: string) {
    setJsonToEdiMappings((prev) => removeMapping(prev, edgeId));
  }

  function handleAddField(parentId: string) {
    setAddingParentId(parentId);
    setAddName("");
    setAddType("string");
  }

  function submitAddField() {
    if (!targetJsonTree || !addingParentId || !addName.trim()) return;
    setTargetJsonTree(addChild(targetJsonTree, addingParentId, { name: addName.trim(), type: addType }));
    setAddingParentId(null);
  }

  function handleRemoveField(nodeId: string) {
    if (!targetJsonTree || nodeId === "root") return;
    const removed = findNode(targetJsonTree, nodeId);
    setTargetJsonTree(removeNode(targetJsonTree, nodeId));
    if (removed) {
      const removedIds = new Set(collectIds(removed));
      setJsonToEdiMappings((prev) => pruneMappingsForRemovedIds(prev, removedIds));
    }
  }

  function handleRenameField(nodeId: string, label: string) {
    if (!targetJsonTree) return;
    setTargetJsonTree(renameNode(targetJsonTree, nodeId, label));
  }

  function handleAppendStep(step: MappingTransformStep) {
    if (!transformTargetId) return;
    setJsonToEdiMappings((prev) => {
      const current = prev.find((m) => m.targetNodeId === transformTargetId);
      return setMappingTransform(prev, transformTargetId, appendTransformStep(current?.transform, step));
    });
  }

  function handleRemoveStep(index: number) {
    if (!transformTargetId) return;
    setJsonToEdiMappings((prev) => {
      const current = prev.find((m) => m.targetNodeId === transformTargetId);
      if (!current?.transform) return prev;
      return setMappingTransform(prev, transformTargetId, removeTransformStep(current.transform, index));
    });
  }

  function handleClearTransform() {
    if (!transformTargetId) return;
    setJsonToEdiMappings((prev) => setMappingTransform(prev, transformTargetId, undefined));
  }

  function handleSetConstant(value: string) {
    if (!transformTargetId) return;
    setJsonToEdiMappings((prev) => upsertConstantMapping(prev, transformTargetId, value));
  }

  function handleDisconnectTarget() {
    if (!transformTargetId) return;
    setJsonToEdiMappings((prev) => prev.filter((m) => m.targetNodeId !== transformTargetId));
  }

  function handleLoopRuleChange(field: "onBegin" | "onEnd", value: string) {
    if (!loopNodeId) return;
    setNodeRules((prev) => ({ ...prev, [loopNodeId]: { ...prev[loopNodeId], [field]: value } }));
  }

  function handleImportStructure() {
    try {
      const inferred = inferSchemaFromJson(importJsonText);
      const oldIds = new Set(targetJsonTree ? collectIds(targetJsonTree) : []);
      const newIds = new Set(collectIds(inferred));
      const removedIds = new Set([...oldIds].filter((id) => !newIds.has(id)));
      setTargetJsonTree(inferred);
      setJsonToEdiMappings((prev) => pruneMappingsForRemovedIds(prev, removedIds));
      setImportError(null);
    } catch (e) {
      setImportError(e instanceof JsonParseError ? e.message : "Failed to parse JSON.");
    }
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportJsonText(await file.text());
    e.target.value = "";
  }

  function handleGeneratePreview() {
    if (!schema || !targetJsonTree) return;
    try {
      const payload = JSON.parse(sampleJsonText);
      setPreviewResult(generateEdiPreview(schema, targetJsonTree, jsonToEdiMappings, payload, { globalVarDecls, nodeRules }));
      setPreviewError(null);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Invalid JSON.");
      setPreviewResult(null);
    }
  }

  async function handleSampleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSampleJsonText(await file.text());
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          JSON → EDI Mapping Workbench
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Build the JSON shape on the left (schema-as-you-go — use + to add fields), pick a
          target transaction set on the right, then drag from a JSON field&rsquo;s handle to an
          EDI element&rsquo;s handle to connect them. Click a connection line to remove it.
        </p>
      </div>

      <MapCompletionPrompt isComplete={isMappingComplete} />

      <EdiTransactionPicker />

      <details className="rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <summary
          className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--ink-muted)" }}
        >
          Import structure from sample JSON
        </summary>
        <div className="flex flex-col gap-2 p-4 pt-0">
          <div className="flex items-center justify-between">
            <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
              Paste or upload a sample JSON document — its shape replaces the JSON tree below
              (existing mappings into fields that no longer exist are dropped). Faster than
              building the tree field-by-field with +.
            </p>
            <button
              type="button"
              onClick={() => importFileInputRef.current?.click()}
              className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium"
              style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
            >
              Upload file
            </button>
            <input ref={importFileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          </div>
          <ApiFetchPanel onFetched={setImportJsonText} />
          <textarea
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            spellCheck={false}
            placeholder={`{\n  "Header": { "PoNumber": "PO-1001", "BuyerName": "Acme Corp" },\n  "Items": [ { "Sku": "SKU-1", "Qty": 4 } ]\n}`}
            className="h-32 rounded-lg border p-3 font-mono text-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          />
          <button
            type="button"
            onClick={handleImportStructure}
            className="self-start rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Build structure from sample
          </button>
          {importError && (
            <div
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {importError}
            </div>
          )}
        </div>
      </details>

      {targetJsonTree && targetRoot && (
        <MappingCanvas
          sourceRoot={targetJsonTree}
          targetRoot={targetRoot}
          mappings={jsonToEdiMappings}
          onConnect={handleConnect}
          onRemoveMapping={handleRemoveMapping}
          onAddField={handleAddField}
          onRemoveField={handleRemoveField}
          onRenameField={handleRenameField}
          onOpenTransform={(id) => setTransformTargetId(id)}
          activeTransformTargetId={transformTargetId}
          issues={validationIssues}
        />
      )}

      <TransformPanel
        key={transformTargetId ?? "none"}
        sourceRoot={targetJsonTree}
        targetRoot={targetRoot}
        targetNodeId={transformTargetId}
        mapping={transformMapping}
        samplePayload={samplePayload}
        onAppendStep={handleAppendStep}
        onRemoveStep={handleRemoveStep}
        onClearTransform={handleClearTransform}
        onSetConstant={handleSetConstant}
        onRemoveMapping={handleDisconnectTarget}
        onClose={() => setTransformTargetId(null)}
      />

      {addingParentId && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <span style={{ color: "var(--ink-muted)" }}>Add field under</span>
          <code className="text-xs" style={{ color: "var(--ink)" }}>
            {addingParentId}
          </code>
          <input
            autoFocus
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAddField()}
            placeholder="field name"
            className="rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
          />
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value as AddChildInput["type"])}
            className="rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={submitAddField}
            className="rounded-md px-3 py-1 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAddingParentId(null)}
            className="rounded-md border px-3 py-1 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
          >
            Cancel
          </button>
        </div>
      )}

      {schema && loopNodeId && (
        <details className="rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <summary
            className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--ink-muted)" }}
          >
            Extended rules — {schema.bodyLoop.id} loop
          </summary>
          <div className="flex flex-col gap-3 p-4 pt-0">
            <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
              On Begin runs before each repeating instance is mapped — use <code>SKIP;</code> to
              drop it entirely (e.g. skip an N1 loop unless a qualifier matches). On End runs
              after each instance — typical for accumulating a global running total. Declare
              globals to read/write on the <a href="/map/json-to-edi/globals" className="font-semibold" style={{ color: "var(--accent)" }}>Global Variables</a> page.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                  On Begin
                </span>
                <textarea
                  value={loopRules?.onBegin ?? ""}
                  onChange={(e) => handleLoopRuleChange("onBegin", e.target.value)}
                  spellCheck={false}
                  placeholder={'IF #Qty == 0 THEN\n  SKIP;\nEND;'}
                  className="h-28 rounded-lg border p-2 font-mono text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                  On End
                </span>
                <textarea
                  value={loopRules?.onEnd ?? ""}
                  onChange={(e) => handleLoopRuleChange("onEnd", e.target.value)}
                  spellCheck={false}
                  placeholder="GlobalTotal = GlobalTotal + #LinePrice;"
                  className="h-28 rounded-lg border p-2 font-mono text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
                />
              </div>
            </div>
          </div>
        </details>
      )}

      <details className="rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <summary
          className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--ink-muted)" }}
        >
          Test / preview
        </summary>
        <div className="flex flex-col gap-2 p-4 pt-0">
          <div className="flex items-center justify-between">
            <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
              Paste a sample JSON payload matching the fields built above, then generate the raw
              EDI segments your current mappings produce. Envelope segments (ISA/GS/ST…) aren&rsquo;t
              generated yet — this previews the transaction body only.
            </p>
            <button
              type="button"
              onClick={() => sampleFileInputRef.current?.click()}
              className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium"
              style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
            >
              Upload sample JSON
            </button>
            <input ref={sampleFileInputRef} type="file" accept=".json" className="hidden" onChange={handleSampleFile} />
          </div>
          <ApiFetchPanel onFetched={setSampleJsonText} />
          <textarea
            value={sampleJsonText}
            onChange={(e) => setSampleJsonText(e.target.value)}
            spellCheck={false}
            placeholder={`{\n  "Header": { "BuyerName": "Acme Corp" },\n  "Items": [ { "Sku": "SKU-1", "Qty": 4 } ]\n}`}
            className="h-40 rounded-lg border p-3 font-mono text-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          />
          <button
            type="button"
            onClick={handleGeneratePreview}
            disabled={!targetJsonTree || !schema}
            className="self-start rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: !targetJsonTree || !schema ? 0.6 : 1 }}
          >
            Generate EDI
          </button>

          {previewError && (
            <div
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {previewError}
            </div>
          )}

          {previewResult && (
            <div className="flex flex-col gap-2">
              {previewResult.issues.length > 0 && (
                <ul className="list-inside list-disc rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--border)" }}>
                  {previewResult.issues.map((issue, i) => (
                    <li
                      key={i}
                      style={{
                        color: issue.severity === "error" ? "var(--danger)" : "var(--warning)",
                        background: issue.severity === "error" ? "var(--danger-soft)" : "var(--warning-soft)",
                      }}
                    >
                      <span className="font-semibold uppercase">{issue.severity}</span> — {issue.message}
                    </li>
                  ))}
                </ul>
              )}
              {Object.keys(previewResult.globals).length > 0 && (
                <div
                  className="rounded-md border px-3 py-2 text-xs"
                  style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
                >
                  <div className="mb-1 font-semibold uppercase" style={{ color: "var(--ink-muted)" }}>
                    Global variables after this run
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono" style={{ color: "var(--ink)" }}>
                    {Object.entries(previewResult.globals).map(([name, v]) => (
                      <span key={name}>
                        {name} = {String(v.value)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <pre
                className="overflow-x-auto rounded-lg border p-3 font-mono text-xs whitespace-pre-wrap"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
              >
                {previewResult.segments.length > 0 ? previewResult.segments.join("\n") : "(no segments generated)"}
              </pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

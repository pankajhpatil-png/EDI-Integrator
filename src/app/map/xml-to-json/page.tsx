"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { addChild, collectIds, findNode, removeNode, renameNode, type AddChildInput } from "@/lib/schema/treeOps";
import type { LeafDataType, SchemaNode } from "@/lib/schema/types";
import { inferSchemaFromXml, XmlParseError } from "@/lib/xml/inferSchema";
import { xmlToPayloadObject } from "@/lib/xml/xmlToPayloadObject";
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
import { generateJsonPreview, type JsonPreviewResult } from "@/lib/mapping/generateJsonPreview";
import { useAppState } from "@/lib/store/AppStateContext";
import MappingCanvas from "@/components/mapping/MappingCanvas";
import TransformPanel from "@/components/mapping/TransformPanel";
import ApiFetchPanel from "@/components/api/ApiFetchPanel";

const SAMPLE_XML = `<Order id="PO-1001">
  <Header>
    <BuyerName>Acme Corp</BuyerName>
    <OrderDate>2026-08-15</OrderDate>
  </Header>
  <Items>
    <Item sku="SKU-1">
      <Qty>4</Qty>
      <Price>19.99</Price>
    </Item>
    <Item sku="SKU-2">
      <Qty>1</Qty>
      <Price>249.00</Price>
    </Item>
  </Items>
</Order>`;

const FIELD_TYPES: (LeafDataType | "object" | "array")[] = ["string", "number", "date", "boolean", "object", "array"];

function emptyJsonRoot(): SchemaNode {
  return { id: "root", label: "json", path: "root", kind: "object", children: [], meta: { source: "json" } };
}

export default function XmlToJsonPage() {
  const {
    sourceXmlTree,
    setSourceXmlTree,
    targetJsonTree,
    setTargetJsonTree,
    xmlToJsonMappings,
    setXmlToJsonMappings,
    sampleXmlText,
    setSampleXmlText,
    globalVarDecls,
  } = useAppState();

  const [xmlText, setXmlText] = useState(sampleXmlText || SAMPLE_XML);
  const [inferError, setInferError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Local, imperative — NOT derived from sourceXmlTree. A computed `open` gets
  // re-applied by React on every render (e.g. each keystroke in the XML textarea
  // below), which would snap this shut mid-edit once something's been inferred.
  const [sourceOpen, setSourceOpen] = useState(!sampleXmlText);

  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addType, setAddType] = useState<AddChildInput["type"]>("string");

  const [transformTargetId, setTransformTargetId] = useState<string | null>(null);
  const transformMapping = xmlToJsonMappings.find((m) => m.targetNodeId === transformTargetId);

  const [previewResult, setPreviewResult] = useState<JsonPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const targetRoot = targetJsonTree ?? emptyJsonRoot();

  const samplePayload = useMemo(() => {
    try {
      return sampleXmlText ? xmlToPayloadObject(sampleXmlText) : null;
    } catch {
      return null;
    }
  }, [sampleXmlText]);

  function handleInfer() {
    try {
      setSourceXmlTree(inferSchemaFromXml(xmlText));
      setSampleXmlText(xmlText);
      setInferError(null);
      setSourceOpen(false); // reveal the canvas below — a one-time action, not a reactive rule
    } catch (e) {
      setInferError(e instanceof XmlParseError ? e.message : "Failed to parse XML.");
      setSourceXmlTree(null);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlText(await file.text());
    e.target.value = "";
  }

  function handleConnect(sourceNodeId: string, targetNodeId: string) {
    setXmlToJsonMappings((prev) => upsertMapping(prev, sourceNodeId, targetNodeId));
  }

  function handleRemoveMapping(edgeId: string) {
    setXmlToJsonMappings((prev) => removeMapping(prev, edgeId));
  }

  function handleAddField(parentId: string) {
    setAddingParentId(parentId);
    setAddName("");
    setAddType("string");
  }

  function submitAddField() {
    if (!addingParentId || !addName.trim()) return;
    setTargetJsonTree(addChild(targetRoot, addingParentId, { name: addName.trim(), type: addType }));
    setAddingParentId(null);
  }

  function handleRemoveField(nodeId: string) {
    if (nodeId === "root") return;
    const removed = findNode(targetRoot, nodeId);
    setTargetJsonTree(removeNode(targetRoot, nodeId));
    if (removed) {
      const removedIds = new Set(collectIds(removed));
      setXmlToJsonMappings((prev) => pruneMappingsForRemovedIds(prev, removedIds));
    }
  }

  function handleRenameField(nodeId: string, label: string) {
    setTargetJsonTree(renameNode(targetRoot, nodeId, label));
  }

  function handleAppendStep(step: MappingTransformStep) {
    if (!transformTargetId) return;
    setXmlToJsonMappings((prev) => {
      const current = prev.find((m) => m.targetNodeId === transformTargetId);
      return setMappingTransform(prev, transformTargetId, appendTransformStep(current?.transform, step));
    });
  }

  function handleRemoveStep(index: number) {
    if (!transformTargetId) return;
    setXmlToJsonMappings((prev) => {
      const current = prev.find((m) => m.targetNodeId === transformTargetId);
      if (!current?.transform) return prev;
      return setMappingTransform(prev, transformTargetId, removeTransformStep(current.transform, index));
    });
  }

  function handleClearTransform() {
    if (!transformTargetId) return;
    setXmlToJsonMappings((prev) => setMappingTransform(prev, transformTargetId, undefined));
  }

  function handleSetConstant(value: string) {
    if (!transformTargetId) return;
    setXmlToJsonMappings((prev) => upsertConstantMapping(prev, transformTargetId, value));
  }

  function handleDisconnectTarget() {
    if (!transformTargetId) return;
    setXmlToJsonMappings((prev) => prev.filter((m) => m.targetNodeId !== transformTargetId));
  }

  function handleGeneratePreview() {
    if (!sourceXmlTree) return;
    try {
      const payload = xmlToPayloadObject(sampleXmlText || xmlText);
      setPreviewResult(generateJsonPreview(targetRoot, sourceXmlTree, xmlToJsonMappings, payload, { globalVarDecls }));
      setPreviewError(null);
    } catch (e) {
      setPreviewError(e instanceof XmlParseError ? e.message : "Failed to parse sample XML.");
      setPreviewResult(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          XML → JSON Mapping Workbench
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Infer structure from a sample XML document, then drag from an XML field&rsquo;s handle
          to a JSON field&rsquo;s handle to connect them (use + to add JSON fields as you go).
          Click a connection line to remove it.
        </p>
      </div>

      <details
        className="rounded-lg border"
        style={{ borderColor: "var(--border)" }}
        open={sourceOpen}
        onToggle={(e) => setSourceOpen(e.currentTarget.open)}
      >
        <summary
          className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--ink-muted)" }}
        >
          Source XML sample
        </summary>
        <div className="flex flex-col gap-2 p-4 pt-0">
          <div className="flex items-center justify-between">
            <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
              Paste, upload, or fetch a sample XML document, then infer its structure.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium"
              style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
            >
              Upload file
            </button>
            <input ref={fileInputRef} type="file" accept=".xml" className="hidden" onChange={handleFile} />
          </div>
          <ApiFetchPanel format="xml" onFetched={setXmlText} />
          <textarea
            value={xmlText}
            onChange={(e) => setXmlText(e.target.value)}
            spellCheck={false}
            className="h-48 rounded-lg border p-3 font-mono text-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
          />
          <button
            type="button"
            onClick={handleInfer}
            className="self-start rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Infer structure
          </button>
          {inferError && (
            <div
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {inferError}
            </div>
          )}
        </div>
      </details>

      {sourceXmlTree && (
        <MappingCanvas
          sourceRoot={sourceXmlTree}
          targetRoot={targetRoot}
          mappings={xmlToJsonMappings}
          onConnect={handleConnect}
          onRemoveMapping={handleRemoveMapping}
          onAddField={handleAddField}
          onRemoveField={handleRemoveField}
          onRenameField={handleRenameField}
          editableSide="target"
          onOpenTransform={(id) => setTransformTargetId(id)}
          activeTransformTargetId={transformTargetId}
          issues={previewResult?.issues}
        />
      )}

      {sourceXmlTree && (
        <TransformPanel
          key={transformTargetId ?? "none"}
          sourceRoot={sourceXmlTree}
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
      )}

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

      {sourceXmlTree && (
        <div className="flex flex-col gap-2 rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            Test / preview
          </span>
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Generates a real JSON document from the sample XML above, using the current mappings —
            handy for checking a mapping before moving to the JSON → EDI stage.
          </p>
          <button
            type="button"
            onClick={handleGeneratePreview}
            className="self-start rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Generate JSON preview
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
              <pre
                className="overflow-x-auto rounded-lg border p-3 font-mono text-xs whitespace-pre-wrap"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
              >
                {JSON.stringify(previewResult.document, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

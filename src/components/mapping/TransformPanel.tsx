"use client";

import { useMemo, useState } from "react";
import type { SchemaNode } from "@/lib/schema/types";
import { findNode, flattenLeaves } from "@/lib/schema/treeOps";
import { isConstRef, constRefValue, type MappingEdge, type MappingTransformStep } from "@/lib/mapping/types";
import { resolveJsonValue } from "@/lib/mapping/resolveJsonValue";
import { evaluateTransformSteps, type TransformStepsResult } from "@/lib/mapping/evaluateTransform";
import { buildTransformStep, TRANSFORM_FUNCTIONS, type TransformFunctionSpec } from "@/lib/mapping/transformCatalog";
import { buildInitialGlobals, globalRefName, isGlobalRef } from "@/lib/rules/mappingIntegration";
import { ruleValueToString } from "@/lib/rules/interpreter";
import { useAppState } from "@/lib/store/AppStateContext";

export interface TransformPanelProps {
  sourceRoot: SchemaNode | null;
  targetRoot: SchemaNode | null;
  targetNodeId: string | null;
  mapping: MappingEdge | undefined;
  // Already-parsed sample payload to preview against — the caller owns parsing
  // (JSON.parse for the JSON->EDI stage, xmlToPayloadObject for XML->JSON) so this
  // component stays agnostic to which stage it's rendering for.
  samplePayload: unknown;
  onAppendStep: (step: MappingTransformStep) => void;
  onRemoveStep: (index: number) => void;
  onClearTransform: () => void;
  onSetConstant: (value: string) => void;
  onRemoveMapping: () => void;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<TransformFunctionSpec["category"], string> = {
  string: "String functions",
  arithmetic: "Arithmetic functions",
  conditional: "Conditional",
};

function renderPreview(preview: TransformStepsResult | null) {
  if (!preview) return null;
  return "error" in preview ? (
    <span style={{ color: "var(--danger)" }}>⚠ {preview.error}</span>
  ) : (
    <span style={{ color: "var(--ink)" }}>
      Preview: <span className="font-mono font-semibold">{preview.value || "(empty)"}</span>
    </span>
  );
}

export default function TransformPanel({
  sourceRoot,
  targetRoot,
  targetNodeId,
  mapping,
  samplePayload,
  onAppendStep,
  onRemoveStep,
  onClearTransform,
  onSetConstant,
  onRemoveMapping,
  onClose,
}: TransformPanelProps) {
  const { globalVarDecls } = useAppState();

  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [argValues, setArgValues] = useState<string[]>([]);
  const [constDraft, setConstDraft] = useState(() =>
    mapping && isConstRef(mapping.sourceNodeId) ? constRefValue(mapping.sourceNodeId) : ""
  );

  const sourceLeaves = useMemo(() => (sourceRoot ? flattenLeaves(sourceRoot) : []), [sourceRoot]);
  const globals = useMemo(() => buildInitialGlobals(globalVarDecls), [globalVarDecls]);

  function labelForField(sourceNodeId: string): string {
    return (sourceRoot && findNode(sourceRoot, sourceNodeId)?.label) || sourceNodeId;
  }

  function resolveRawValue(sourceNodeId: string): string {
    if (isGlobalRef(sourceNodeId)) return ruleValueToString(globals.get(globalRefName(sourceNodeId)));
    if (isConstRef(sourceNodeId)) return constRefValue(sourceNodeId);
    if (!sourceRoot || samplePayload === null) return "";
    return resolveJsonValue(sourceRoot, sourceNodeId, samplePayload, 0);
  }

  function selectFunction(spec: TransformFunctionSpec) {
    setSelectedFunctionId(spec.id);
    setArgValues(spec.args.map((a) => (a.kind === "field" ? sourceLeaves[0]?.id ?? "" : a.defaultValue)));
  }

  function cancelSelection() {
    setSelectedFunctionId(null);
    setArgValues([]);
  }

  function applySelection(primaryLabel: string) {
    const spec = TRANSFORM_FUNCTIONS.find((f) => f.id === selectedFunctionId);
    if (!spec) return;
    onAppendStep(buildTransformStep(spec, argValues, primaryLabel, labelForField));
    cancelSelection();
  }

  if (!targetNodeId) {
    return (
      <div
        className="flex flex-col gap-2 rounded-lg border p-3 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface-raised)", color: "var(--ink-muted)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wide">Functions</span>
        Click the <span className="font-mono">ƒx</span> button on a target field to connect it to a constant
        value, or to attach a chain of string/arithmetic/conditional functions to its mapping.
      </div>
    );
  }

  const targetLabel = (targetRoot && findNode(targetRoot, targetNodeId)?.label) || targetNodeId;
  const selectedSpec = TRANSFORM_FUNCTIONS.find((f) => f.id === selectedFunctionId);
  const sourceLabel = mapping && !isConstRef(mapping.sourceNodeId) ? labelForField(mapping.sourceNodeId) : null;

  const steps = mapping?.transform?.steps ?? [];
  const rawValue = mapping ? resolveRawValue(mapping.sourceNodeId) : "";

  // Preview after each existing step — stepPreviews[i] is the value once steps[0..i]
  // have run, so removing/inspecting a specific step shows what it actually produced.
  const stepPreviews: TransformStepsResult[] = [];
  {
    let running: TransformStepsResult = { value: rawValue };
    for (const step of steps) {
      if ("error" in running) {
        stepPreviews.push(running);
        continue;
      }
      running = evaluateTransformSteps([step], running.value, resolveRawValue, globals, samplePayload);
      stepPreviews.push(running);
    }
  }
  const finalPreview = stepPreviews.length > 0 ? stepPreviews[stepPreviews.length - 1] : mapping ? { value: rawValue } : null;

  const draftPreview =
    mapping && selectedSpec && !("error" in (finalPreview ?? { value: "" }))
      ? evaluateTransformSteps(
          [buildTransformStep(selectedSpec, argValues, sourceLabel ?? "previous step's result", labelForField)],
          finalPreview && "value" in finalPreview ? finalPreview.value : rawValue,
          resolveRawValue,
          globals,
          samplePayload
        )
      : null;

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-3"
      style={{ borderColor: "var(--accent)", background: "var(--surface-raised)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          {targetLabel}
        </span>
        <button type="button" onClick={onClose} className="rounded px-1 font-bold" style={{ color: "var(--ink-muted)" }}>
          ×
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        {mapping ? (
          <span style={{ color: "var(--ink-muted)" }}>
            {isConstRef(mapping.sourceNodeId) ? (
              <>
                constant <span className="font-mono" style={{ color: "var(--ink)" }}>{constRefValue(mapping.sourceNodeId)}</span>
              </>
            ) : isGlobalRef(mapping.sourceNodeId) ? (
              <>
                from <span className="font-mono" style={{ color: "var(--ink)" }}>{mapping.sourceNodeId}</span>
              </>
            ) : (
              <>
                from <span className="font-mono" style={{ color: "var(--ink)" }}>{sourceLabel}</span>
              </>
            )}
          </span>
        ) : (
          <span style={{ color: "var(--ink-muted)" }}>Not connected yet.</span>
        )}
        {mapping && (
          <button type="button" onClick={onRemoveMapping} className="shrink-0 font-semibold" style={{ color: "var(--danger)" }}>
            Disconnect
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          Set a fixed value
        </span>
        <div className="flex gap-2">
          <input
            value={constDraft}
            onChange={(e) => setConstDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSetConstant(constDraft)}
            placeholder='e.g. "00"'
            className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
          />
          <button
            type="button"
            onClick={() => onSetConstant(constDraft)}
            className="shrink-0 rounded-md border px-2 py-1 text-xs font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
          >
            Set
          </button>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
              Steps (applied in order)
            </span>
            <button type="button" onClick={onClearTransform} className="shrink-0 font-semibold" style={{ color: "var(--danger)" }}>
              Clear all
            </button>
          </div>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span style={{ color: "var(--ink)" }}>
                {i + 1}. <span className="font-mono">{step.summary}</span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {renderPreview(stepPreviews[i])}
                <button type="button" onClick={() => onRemoveStep(i)} className="rounded px-1 font-bold" style={{ color: "var(--danger)" }}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mapping &&
        (selectedSpec ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
              {steps.length > 0 ? `Add step: ${selectedSpec.label}` : selectedSpec.label}
            </span>
            {selectedSpec.args.map((argSpec, i) => (
              <label key={i} className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                {argSpec.label}
                {argSpec.kind === "field" ? (
                  <select
                    value={argValues[i] ?? ""}
                    onChange={(e) => setArgValues((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    className="rounded-md border px-2 py-1 text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
                  >
                    {sourceLeaves.map((leaf) => (
                      <option key={leaf.id} value={leaf.id}>
                        {leaf.path}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={argSpec.kind === "literal-number" ? "number" : "text"}
                    value={argValues[i] ?? ""}
                    onChange={(e) => setArgValues((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    className="rounded-md border px-2 py-1 text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
                  />
                )}
              </label>
            ))}
            <div className="text-xs">{renderPreview(draftPreview)}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => applySelection(sourceLabel ?? "")}
                className="rounded-md px-3 py-1 text-sm font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {steps.length > 0 ? "Add step" : "Apply"}
              </button>
              <button
                type="button"
                onClick={cancelSelection}
                className="rounded-md border px-3 py-1 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(["string", "arithmetic", "conditional"] as const).map((category) => (
              <div key={category} className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
                  {CATEGORY_LABEL[category]}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TRANSFORM_FUNCTIONS.filter((f) => f.category === category).map((spec) => (
                    <button
                      key={spec.id}
                      type="button"
                      onClick={() => selectFunction(spec)}
                      className="rounded-md border px-2 py-1 text-xs font-medium"
                      style={{ borderColor: "var(--border)", color: "var(--ink)", background: "var(--surface)" }}
                    >
                      {spec.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

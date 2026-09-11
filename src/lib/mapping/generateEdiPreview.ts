import type { EdiDataType, EdiSegmentSchema, EdiTransactionSchema } from "@/lib/edi/schemaTypes";
import { buildSegment } from "@/lib/edi/segmentWriter";
import { DEFAULT_EDIFACT_DELIMITERS, DEFAULT_X12_DELIMITERS } from "@/lib/edi/delimiterTypes";
import type { SchemaNode } from "@/lib/schema/types";
import type { ValidationIssue } from "@/lib/validation/types";
import { validateMapping } from "@/lib/validation/validateMapping";
import { evaluateRule, ruleValueToString } from "@/lib/rules/interpreter";
import { buildInitialGlobals, globalRefName, isGlobalRef, type GlobalVarDecl, type NodeRules } from "@/lib/rules/mappingIntegration";
import type { RuleValue } from "@/lib/rules/types";
import { buildEdiElementIndex, elementIdFromTargetNodeId } from "./ediSchemaIndex";
import { evaluateTransformSteps } from "./evaluateTransform";
import { resolveJsonValue, resolveLoopArray } from "./resolveJsonValue";
import { isConstRef, constRefValue, type MappingEdge } from "./types";

// Deterministic preview-only transformation: applies the current field mappings to a
// sample JSON payload and renders the transaction body (header/loop/trailer segments).
// Envelope segments (ISA/GS/ST... or UNA/UNB/UNH... and their closing counterparts) are
// NOT generated here — that needs sender/receiver/control-number configuration that
// doesn't exist anywhere in the tool yet, so segmentCount/controlNumber below are
// best-effort approximations for previewing shape, not spec-exact interchange values.

export interface EdiPreviewOptions {
  globalVarDecls?: GlobalVarDecl[];
  // Keyed by EDI target SchemaNode id — V1 only looks up the body loop's id
  // (`root.${bodyLoop.id}[]`), the one repeating block the tool models.
  nodeRules?: Record<string, NodeRules>;
}

export interface EdiPreviewResult {
  segments: string[];
  issues: ValidationIssue[];
  globals: Record<string, RuleValue>;
}

// Best-effort format checks — deliberately permissive (only the clearly-wrong shapes
// get flagged) since this is previewing a sample, not a full EDI conformance suite.
const DATA_TYPE_FORMAT: Partial<Record<EdiDataType, RegExp>> = {
  N0: /^-?\d+$/,
  N2: /^-?\d+(\.\d{1,2})?$/,
  DT: /^\d{8}$|^\d{4}-\d{2}-\d{2}$/,
};

export function generateEdiPreview(
  schema: EdiTransactionSchema,
  jsonRoot: SchemaNode,
  mappings: MappingEdge[],
  payload: unknown,
  options: EdiPreviewOptions = {}
): EdiPreviewResult {
  const { globalVarDecls = [], nodeRules = {} } = options;
  const delimiters = schema.standard === "X12" ? DEFAULT_X12_DELIMITERS : DEFAULT_EDIFACT_DELIMITERS;
  const index = buildEdiElementIndex(schema);
  const segments: string[] = [];
  const issues: ValidationIssue[] = validateMapping(schema, jsonRoot, mappings);
  const globals = buildInitialGlobals(globalVarDecls);

  function findMapping(elementId: string) {
    return mappings.find((m) => elementIdFromTargetNodeId(m.targetNodeId) === elementId);
  }

  // Global- and constant-sourced mappings aren't backed by a JSON array, so they're
  // excluded when hunting for which array actually drives the loop's iteration count.
  const loopMapping = mappings.find(
    (m) => !isGlobalRef(m.sourceNodeId) && !isConstRef(m.sourceNodeId) && index.get(elementIdFromTargetNodeId(m.targetNodeId))?.isLoop
  );
  const loopArray = loopMapping ? resolveLoopArray(jsonRoot, loopMapping.sourceNodeId, payload) : null;
  const loopCount = loopArray?.length ?? 0;
  if (loopMapping && loopCount === 0) {
    issues.push({
      severity: "warning",
      scope: "data",
      message: `No items found in the sample JSON for the "${schema.bodyLoop.id}" loop — 0 instances generated.`,
    });
  }

  function buildValues(seg: EdiSegmentSchema, loopIndex: number | null): Record<string, string> {
    const values: Record<string, string> = {};
    for (const el of seg.elements) {
      if (el.derivedValue === "loopInstanceCount") {
        values[el.id] = String(loopCount);
        continue;
      }
      if (el.derivedValue === "controlNumber") {
        values[el.id] = "0001"; // preview placeholder — real control numbers need persisted state
        continue;
      }
      if (el.derivedValue === "segmentCount") {
        values[el.id] = String(segments.length + 2); // +1 for this segment, +1 for the (unmodeled) ST
        continue;
      }

      const mapping = findMapping(el.id);
      if (!mapping) continue;
      const rawValue = isGlobalRef(mapping.sourceNodeId)
        ? ruleValueToString(globals.get(globalRefName(mapping.sourceNodeId)))
        : isConstRef(mapping.sourceNodeId)
          ? constRefValue(mapping.sourceNodeId)
          : resolveJsonValue(jsonRoot, mapping.sourceNodeId, payload, loopIndex);

      const itemPrefix = loopIndex !== null ? `Item ${loopIndex + 1}: ` : "";
      const targetNodeId = index.get(el.id)?.targetNodeId;

      const stepResult = evaluateTransformSteps(
        mapping.transform?.steps ?? [],
        rawValue,
        (fieldId) => resolveJsonValue(jsonRoot, fieldId, payload, loopIndex),
        globals,
        payload
      );
      if ("error" in stepResult) {
        issues.push({
          severity: "error",
          scope: "data",
          targetNodeId,
          sourceNodeId: mapping.sourceNodeId,
          message: `${itemPrefix}${el.id} (${el.name}): transform "${stepResult.failedStep.summary}" failed — ${stepResult.error}`,
        });
      }
      const value = "error" in stepResult ? "" : stepResult.value;
      values[el.id] = value;
      if (el.required && value === "") {
        issues.push({
          severity: "error",
          scope: "data",
          targetNodeId,
          sourceNodeId: mapping.sourceNodeId,
          message: `${itemPrefix}${el.id} (${el.name}) is mapped but resolved empty for this sample.`,
        });
      }
      if (value && el.maxLength && value.length > el.maxLength) {
        issues.push({
          severity: "error",
          scope: "data",
          targetNodeId,
          sourceNodeId: mapping.sourceNodeId,
          message: `${itemPrefix}${el.id} (${el.name}) value "${value}" exceeds max length ${el.maxLength}.`,
        });
      }
      const format = DATA_TYPE_FORMAT[el.dataType];
      if (value && format && !format.test(value)) {
        issues.push({
          severity: "warning",
          scope: "data",
          targetNodeId,
          sourceNodeId: mapping.sourceNodeId,
          message: `${itemPrefix}${el.id} (${el.name}) value "${value}" doesn't look like a valid ${el.dataType} value.`,
        });
      }
    }
    return values;
  }

  for (const seg of schema.header) segments.push(buildSegment(seg, buildValues(seg, null), delimiters, schema.standard));

  const loopNodeId = `root.${schema.bodyLoop.id}[]`;
  const loopRules = nodeRules[loopNodeId];
  for (let i = 0; i < loopCount; i++) {
    const item = loopArray![i];

    if (loopRules?.onBegin) {
      const result = evaluateRule(loopRules.onBegin, { current: item, root: payload, globals });
      if (result.error) {
        issues.push({ severity: "error", scope: "data", message: `Item ${i + 1}: On Begin rule error — ${result.error.message}` });
        continue; // fail safe: skip this instance rather than emit a partial/wrong segment
      }
      if (result.skip) continue;
    }

    for (const seg of schema.bodyLoop.segments) segments.push(buildSegment(seg, buildValues(seg, i), delimiters, schema.standard));

    if (loopRules?.onEnd) {
      const result = evaluateRule(loopRules.onEnd, { current: item, root: payload, globals });
      if (result.error) {
        issues.push({ severity: "error", scope: "data", message: `Item ${i + 1}: On End rule error — ${result.error.message}` });
      }
    }
  }

  for (const seg of schema.trailer) segments.push(buildSegment(seg, buildValues(seg, null), delimiters, schema.standard));

  return { segments, issues, globals: Object.fromEntries(globals) };
}

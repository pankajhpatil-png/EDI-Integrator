import type { SchemaNode } from "@/lib/schema/types";
import { collectIds, pathFromRoot } from "@/lib/schema/treeOps";
import type { ValidationIssue } from "@/lib/validation/types";
import { buildInitialGlobals, globalRefName, isGlobalRef, type GlobalVarDecl } from "@/lib/rules/mappingIntegration";
import { ruleValueToString } from "@/lib/rules/interpreter";
import { evaluateTransformSteps } from "./evaluateTransform";
import { resolveJsonValue, resolveLoopArray } from "./resolveJsonValue";
import { isConstRef, constRefValue, type MappingEdge } from "./types";

// Builds an actual JSON document from the target JSON tree + the XML->JSON field
// mappings, given a normalized XML payload (see xmlToPayloadObject — this function
// takes the already-parsed value, not raw XML text, so it has no DOMParser/browser
// dependency and stays unit-testable with plain object fixtures). Unlike
// generateEdiPreview (one fixed body loop, known from the EDI schema), targetJsonTree
// can have any number of independently-repeating array nodes at any depth, so loop
// count is (re)computed per array node from whichever of its mapped descendants is
// itself backed by an XML array — not a single schema-wide loop.

export interface JsonPreviewOptions {
  globalVarDecls?: GlobalVarDecl[];
}

export interface JsonPreviewResult {
  document: unknown;
  issues: ValidationIssue[];
}

export function generateJsonPreview(
  targetRoot: SchemaNode,
  sourceRoot: SchemaNode,
  mappings: MappingEdge[],
  xmlPayload: unknown,
  options: JsonPreviewOptions = {}
): JsonPreviewResult {
  const { globalVarDecls = [] } = options;
  const globals = buildInitialGlobals(globalVarDecls);
  const issues: ValidationIssue[] = [];

  function findMapping(targetNodeId: string): MappingEdge | undefined {
    return mappings.find((m) => m.targetNodeId === targetNodeId);
  }

  function resolveSourceValue(sourceNodeId: string, loopIndex: number | null): string {
    if (isGlobalRef(sourceNodeId)) return ruleValueToString(globals.get(globalRefName(sourceNodeId)));
    if (isConstRef(sourceNodeId)) return constRefValue(sourceNodeId);
    return resolveJsonValue(sourceRoot, sourceNodeId, xmlPayload, loopIndex);
  }

  function isBackedByXmlArray(sourceNodeId: string): boolean {
    if (isGlobalRef(sourceNodeId) || isConstRef(sourceNodeId)) return false;
    const chain = pathFromRoot(sourceRoot, sourceNodeId);
    return chain?.some((n) => n.kind === "array") ?? false;
  }

  function buildValue(node: SchemaNode, loopIndex: number | null): unknown {
    if (node.kind === "leaf") {
      const mapping = findMapping(node.id);
      if (!mapping) return undefined;

      const rawValue = resolveSourceValue(mapping.sourceNodeId, loopIndex);
      const result = evaluateTransformSteps(mapping.transform?.steps ?? [], rawValue, (id) => resolveSourceValue(id, loopIndex), globals, xmlPayload);
      if ("error" in result) {
        issues.push({
          severity: "error",
          scope: "data",
          targetNodeId: node.id,
          sourceNodeId: mapping.sourceNodeId,
          message: `${node.path}: transform "${result.failedStep.summary}" failed — ${result.error}`,
        });
        return "";
      }
      return result.value;
    }

    if (node.kind === "object") {
      const obj: Record<string, unknown> = {};
      for (const child of node.children ?? []) {
        const value = buildValue(child, loopIndex);
        if (value !== undefined) obj[child.label] = value;
      }
      return obj;
    }

    // node.kind === "array": find which mapped descendant is itself backed by a real
    // XML array — that array's length drives how many instances this node produces.
    const descendantIds = new Set(collectIds(node));
    const loopMapping = mappings.find((m) => descendantIds.has(m.targetNodeId) && isBackedByXmlArray(m.sourceNodeId));
    const loopArray = loopMapping ? resolveLoopArray(sourceRoot, loopMapping.sourceNodeId, xmlPayload) : null;
    const loopCount = loopArray?.length ?? 0;

    if (loopMapping && loopCount === 0) {
      issues.push({
        severity: "warning",
        scope: "data",
        targetNodeId: node.id,
        message: `No items found in the sample XML for "${node.path}" — 0 instances generated.`,
      });
    }
    if (!loopMapping) {
      issues.push({
        severity: "warning",
        scope: "structural",
        targetNodeId: node.id,
        message: `"${node.path}" is a repeating field, but none of its mapped fields are inside a repeating XML element.`,
      });
    }

    const items: unknown[] = [];
    for (let i = 0; i < loopCount; i++) {
      const item: Record<string, unknown> = {};
      for (const child of node.children ?? []) {
        const value = buildValue(child, i);
        if (value !== undefined) item[child.label] = value;
      }
      items.push(item);
    }
    return items;
  }

  const document = buildValue(targetRoot, null);
  return { document, issues };
}

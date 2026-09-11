import type { LeafDataType, SchemaNode } from "@/lib/schema/types";

// Infers a SchemaNode tree from a sample JSON document (BRD 7.2 "infer from sample
// target JSON"), using the same node ids as the manual schema-as-you-go authoring flow
// (`treeOps.addChild`) — no "[]" suffix on array ids — so imported and manually-added
// fields stay editable and mappable together. V1 simplification: an array's item shape
// is taken from its first non-undefined element only (same simplification as the XML
// inference's repeating-element handling).

export class JsonParseError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function guessLeafType(value: unknown): LeafDataType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string" && DATE_RE.test(value)) return "date";
  return "string";
}

function sampleText(value: unknown): string | undefined {
  if (value === null || value === undefined || typeof value === "object") return undefined;
  return String(value);
}

function buildNode(value: unknown, path: string, label: string): SchemaNode {
  if (Array.isArray(value)) {
    const first = value.find((v) => v !== undefined);
    const itemIsObject = first !== undefined && first !== null && typeof first === "object";
    let children: SchemaNode[];
    if (itemIsObject) {
      children = buildNode(first, path, label).children ?? [];
    } else {
      const valuePath = `${path}.#value`;
      children = [
        {
          id: valuePath,
          label: "#value",
          path: valuePath,
          kind: "leaf",
          dataType: guessLeafType(first),
          meta: { source: "json", sample: sampleText(first) },
        },
      ];
    }
    return { id: path, label, path, kind: "array", children, meta: { source: "json" } };
  }

  if (value !== null && typeof value === "object") {
    const children = Object.entries(value as Record<string, unknown>).map(([key, v]) => buildNode(v, `${path}.${key}`, key));
    return { id: path, label, path, kind: "object", children, meta: { source: "json" } };
  }

  return {
    id: path,
    label,
    path,
    kind: "leaf",
    dataType: guessLeafType(value),
    meta: { source: "json", sample: sampleText(value) },
  };
}

export function inferSchemaFromJson(jsonText: string): SchemaNode {
  if (!jsonText.trim()) throw new JsonParseError("Paste or upload a JSON document first.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new JsonParseError(e instanceof Error ? e.message : "Invalid JSON.");
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new JsonParseError("Top-level JSON value must be an object or array.");
  }
  return buildNode(parsed, "root", "json");
}

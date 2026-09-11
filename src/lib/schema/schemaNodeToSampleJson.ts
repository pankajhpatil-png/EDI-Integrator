import type { SchemaNode } from "./types";

// Turns an inferred/authored SchemaNode tree into a plausible plain JSON value — used
// to let the XML->JSON stage export a sample JSON document, which can then be imported
// on the JSON->EDI stage to infer that side's structure (closing the BRD's
// INGEST -> MODEL(JSON) -> MAP -> MAP AGAIN loop) or fed straight into the preview.

function placeholderValue(node: SchemaNode): unknown {
  const sample = node.meta?.sample;
  if (sample !== undefined) {
    if (node.dataType === "number") {
      const n = Number(sample);
      return Number.isNaN(n) ? sample : n;
    }
    if (node.dataType === "boolean") return sample.toLowerCase() === "true";
    return sample;
  }
  switch (node.dataType) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "date":
      return "2026-01-01";
    default:
      return "";
  }
}

export function schemaNodeToSampleJson(node: SchemaNode): unknown {
  if (node.kind === "leaf") return placeholderValue(node);

  if (node.kind === "array") {
    const item: Record<string, unknown> = {};
    for (const child of node.children ?? []) item[child.label] = schemaNodeToSampleJson(child);
    return [item];
  }

  const obj: Record<string, unknown> = {};
  for (const child of node.children ?? []) obj[child.label] = schemaNodeToSampleJson(child);
  return obj;
}

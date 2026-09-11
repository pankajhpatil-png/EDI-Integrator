import type { EdiElementSchema, EdiSegmentSchema, EdiTransactionSchema } from "./schemaTypes";
import type { LeafDataType, SchemaNode } from "@/lib/schema/types";

function ediDataTypeToLeaf(type: EdiElementSchema["dataType"]): LeafDataType {
  if (type === "N0" || type === "N2") return "number";
  if (type === "DT") return "date";
  return "string"; // AN, ID, TM — no dedicated string/time distinction in LeafDataType
}

// fixedValue qualifiers and derivedValue fields (control numbers, counts) are filled
// automatically by the writer, never mapped by the user — excluded from the canvas tree.
function isMappable(el: EdiElementSchema): boolean {
  return el.fixedValue === undefined && el.derivedValue === undefined;
}

function elementNode(el: EdiElementSchema, parentPath: string, segmentTag: string): SchemaNode {
  const path = `${parentPath}.${el.id}`;
  return {
    id: path,
    label: el.name,
    path,
    kind: "leaf",
    dataType: ediDataTypeToLeaf(el.dataType),
    meta: { source: "edi", ediRef: { segmentTag, elementPosition: el.position } },
  };
}

function segmentNode(seg: EdiSegmentSchema, parentPath: string, loopId?: string): SchemaNode {
  const path = `${parentPath}.${seg.tag}`;
  const children = seg.elements.filter(isMappable).map((el) => elementNode(el, path, seg.tag));
  return {
    id: path,
    label: `${seg.tag} — ${seg.name}`,
    path,
    kind: "object",
    children,
    meta: { source: "edi", ediRef: { segmentTag: seg.tag, elementPosition: 0, loopId } },
  };
}

// Converts a hand-authored EDI transaction schema into the same SchemaNode shape the
// XML inference and JSON authoring flows produce, so the mapping canvas never has to
// branch on source/target kind.
export function ediTransactionToSchemaNode(schema: EdiTransactionSchema): SchemaNode {
  const loopPath = `root.${schema.bodyLoop.id}[]`;
  return {
    id: "root",
    label: `${schema.standard} ${schema.transactionCode} — ${schema.name}`,
    path: "root",
    kind: "object",
    meta: { source: "edi" },
    children: [
      {
        id: "root.header",
        label: "Header",
        path: "root.header",
        kind: "object",
        children: schema.header.map((seg) => segmentNode(seg, "root.header")),
        meta: { source: "edi" },
      },
      {
        id: loopPath,
        label: `${schema.bodyLoop.id}[]`,
        path: loopPath,
        kind: "array",
        children: schema.bodyLoop.segments.map((seg) => segmentNode(seg, loopPath, schema.bodyLoop.id)),
        meta: { source: "edi" },
      },
      {
        id: "root.trailer",
        label: "Trailer",
        path: "root.trailer",
        kind: "object",
        children: schema.trailer.map((seg) => segmentNode(seg, "root.trailer")),
        meta: { source: "edi" },
      },
    ],
  };
}

// One tree shape represents an inferred XML tree, an inferred/authored JSON tree,
// and an EDI segment/element/loop tree uniformly — so the canvas and the execution
// engine never need to branch on which kind of source/target they're looking at.
// Only "leaf" nodes are ever connectable on the mapping canvas; "object"/"array"
// nodes are structural rows in the tree browser (expand/collapse only).

export type SchemaNodeKind = "object" | "array" | "leaf";
export type SchemaSourceKind = "xml" | "json" | "edi";
export type LeafDataType = "string" | "number" | "date" | "boolean";

export interface SchemaNodeMeta {
  source: SchemaSourceKind;
  xmlNodeType?: "element" | "attribute";
  ediRef?: { segmentTag: string; elementPosition: number; loopId?: string };
  sample?: string;
}

export interface SchemaNode {
  id: string; // stable path id, e.g. "root.Order.Items[].Sku"
  label: string;
  path: string; // dotted/bracket path used for value-tree get/set
  kind: SchemaNodeKind;
  dataType?: LeafDataType; // meaningful only when kind === "leaf"
  children?: SchemaNode[]; // present for "object" and "array"
  meta?: SchemaNodeMeta;
}

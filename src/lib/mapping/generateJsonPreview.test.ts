import { test } from "node:test";
import assert from "node:assert/strict";
import type { SchemaNode } from "@/lib/schema/types";
import { generateJsonPreview } from "./generateJsonPreview";
import { makeConstRef, type MappingEdge } from "./types";

// Mirrors the shape xmlToPayloadObject would produce for:
// <Order id="PO-1001">
//   <Header><BuyerName>Acme Corp</BuyerName></Header>
//   <Items>
//     <Item><Sku>SKU-1</Sku><Qty>4</Qty></Item>
//     <Item><Sku>SKU-2</Sku><Qty>2</Qty></Item>
//   </Items>
// </Order>
function sourceXmlTree(): SchemaNode {
  return {
    id: "root",
    label: "Order",
    path: "root",
    kind: "object",
    meta: { source: "xml" },
    children: [
      { id: "root.@id", label: "@id", path: "root.@id", kind: "leaf", dataType: "string", meta: { source: "xml", xmlNodeType: "attribute" } },
      {
        id: "root.Header",
        label: "Header",
        path: "root.Header",
        kind: "object",
        meta: { source: "xml", xmlNodeType: "element" },
        children: [{ id: "root.Header.BuyerName", label: "BuyerName", path: "root.Header.BuyerName", kind: "leaf", dataType: "string", meta: { source: "xml" } }],
      },
      {
        id: "root.Items",
        label: "Items",
        path: "root.Items",
        kind: "object",
        meta: { source: "xml", xmlNodeType: "element" },
        children: [
          {
            id: "root.Items.Item[]",
            label: "Item[]",
            path: "root.Items.Item[]",
            kind: "array",
            meta: { source: "xml" },
            children: [
              { id: "root.Items.Item[].Sku", label: "Sku", path: "root.Items.Item[].Sku", kind: "leaf", dataType: "string", meta: { source: "xml" } },
              { id: "root.Items.Item[].Qty", label: "Qty", path: "root.Items.Item[].Qty", kind: "leaf", dataType: "number", meta: { source: "xml" } },
            ],
          },
        ],
      },
    ],
  };
}

function targetJsonTree(): SchemaNode {
  return {
    id: "root",
    label: "json",
    path: "root",
    kind: "object",
    meta: { source: "json" },
    children: [
      { id: "root.PoNumber", label: "PoNumber", path: "root.PoNumber", kind: "leaf", dataType: "string", meta: { source: "json" } },
      { id: "root.Buyer", label: "Buyer", path: "root.Buyer", kind: "leaf", dataType: "string", meta: { source: "json" } },
      {
        id: "root.Lines",
        label: "Lines",
        path: "root.Lines",
        kind: "array",
        meta: { source: "json" },
        children: [
          { id: "root.Lines.Sku", label: "Sku", path: "root.Lines.Sku", kind: "leaf", dataType: "string", meta: { source: "json" } },
          { id: "root.Lines.Qty", label: "Qty", path: "root.Lines.Qty", kind: "leaf", dataType: "number", meta: { source: "json" } },
        ],
      },
    ],
  };
}

const payload = {
  "@id": "PO-1001",
  Header: { BuyerName: "Acme Corp" },
  Items: { "Item[]": [{ Sku: "SKU-1", Qty: "4" }, { Sku: "SKU-2", Qty: "2" }] },
};

const baseMappings: MappingEdge[] = [
  { id: "m1", sourceNodeId: "root.@id", targetNodeId: "root.PoNumber" },
  { id: "m2", sourceNodeId: "root.Header.BuyerName", targetNodeId: "root.Buyer" },
  { id: "m3", sourceNodeId: "root.Items.Item[].Sku", targetNodeId: "root.Lines.Sku" },
  { id: "m4", sourceNodeId: "root.Items.Item[].Qty", targetNodeId: "root.Lines.Qty" },
];

test("generateJsonPreview: builds a nested document with a repeating array driven by an XML array", () => {
  const result = generateJsonPreview(targetJsonTree(), sourceXmlTree(), baseMappings, payload);

  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.document, {
    PoNumber: "PO-1001",
    Buyer: "Acme Corp",
    Lines: [
      { Sku: "SKU-1", Qty: "4" },
      { Sku: "SKU-2", Qty: "2" },
    ],
  });
});

test("generateJsonPreview: a constant mapping needs no XML source field", () => {
  const mappings: MappingEdge[] = [...baseMappings, { id: "m5", sourceNodeId: makeConstRef("v1"), targetNodeId: "root.PoNumber" }].filter(
    (m, i, arr) => arr.findLastIndex((x) => x.targetNodeId === m.targetNodeId) === i
  );
  const result = generateJsonPreview(targetJsonTree(), sourceXmlTree(), mappings, payload);
  assert.equal((result.document as { PoNumber: string }).PoNumber, "v1");
});

test("generateJsonPreview: an unmapped field is omitted from the output rather than emitted empty", () => {
  const partial = baseMappings.filter((m) => m.targetNodeId !== "root.Buyer");
  const result = generateJsonPreview(targetJsonTree(), sourceXmlTree(), partial, payload);
  assert.equal("Buyer" in (result.document as object), false);
});

test("generateJsonPreview: no XML array behind a repeating target field warns and yields zero instances", () => {
  const result = generateJsonPreview(targetJsonTree(), sourceXmlTree(), baseMappings, { ...payload, Items: { "Item[]": [] } });
  assert.deepEqual((result.document as { Lines: unknown[] }).Lines, []);
  assert.ok(result.issues.some((i) => i.severity === "warning" && i.message.includes("Lines")));
});

test("generateJsonPreview: a transform is applied per array item using that item's own value", () => {
  const mappingsWithTransform = baseMappings.map((m) =>
    m.targetNodeId === "root.Lines.Sku" ? { ...m, transform: { steps: [{ expression: "Lowercase(#value)", fieldArgs: [], summary: "lower(…)" }] } } : m
  );
  const result = generateJsonPreview(targetJsonTree(), sourceXmlTree(), mappingsWithTransform, payload);
  assert.deepEqual((result.document as { Lines: { Sku: string }[] }).Lines.map((l) => l.Sku), ["sku-1", "sku-2"]);
});

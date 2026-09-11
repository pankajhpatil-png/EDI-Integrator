import { test } from "node:test";
import assert from "node:assert/strict";
import { findByPath } from "@/lib/schema/treeOps";
import { inferSchemaFromJson, JsonParseError } from "./inferSchema";

test("inferSchemaFromJson: object, nested object, and array-of-object", () => {
  const root = inferSchemaFromJson(
    JSON.stringify({
      Header: { PoNumber: "PO-1001", OrderDate: "2026-08-15", Confirmed: true },
      Items: [
        { Sku: "SKU-1", Qty: 4 },
        { Sku: "SKU-2", Qty: 1 },
      ],
    })
  );

  assert.equal(root.kind, "object");
  assert.equal(root.id, "root");

  const poNumber = findByPath(root, "root.Header.PoNumber");
  assert.equal(poNumber?.kind, "leaf");
  assert.equal(poNumber?.dataType, "string");
  assert.equal(poNumber?.meta?.sample, "PO-1001");

  const orderDate = findByPath(root, "root.Header.OrderDate");
  assert.equal(orderDate?.dataType, "date");

  const confirmed = findByPath(root, "root.Header.Confirmed");
  assert.equal(confirmed?.dataType, "boolean");

  const items = findByPath(root, "root.Items");
  assert.equal(items?.kind, "array");
  assert.equal(items?.children?.length, 2); // Sku, Qty — one item's fields, not two items

  const sku = findByPath(root, "root.Items.Sku");
  assert.equal(sku?.kind, "leaf");
  assert.equal(sku?.meta?.sample, "SKU-1"); // from the first item

  const qty = findByPath(root, "root.Items.Qty");
  assert.equal(qty?.dataType, "number");
});

test("inferSchemaFromJson: array of primitives gets a synthetic #value leaf", () => {
  const root = inferSchemaFromJson(JSON.stringify({ Tags: ["a", "b", "c"] }));
  const tags = findByPath(root, "root.Tags");
  assert.equal(tags?.kind, "array");
  assert.equal(tags?.children?.length, 1);
  assert.equal(tags?.children?.[0].label, "#value");
  assert.equal(tags?.children?.[0].meta?.sample, "a");
});

test("inferSchemaFromJson: rejects invalid JSON and non-object top level", () => {
  assert.throws(() => inferSchemaFromJson("{ not json"), JsonParseError);
  assert.throws(() => inferSchemaFromJson("42"), JsonParseError);
  assert.throws(() => inferSchemaFromJson("   "), JsonParseError);
});

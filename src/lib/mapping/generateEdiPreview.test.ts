import { test } from "node:test";
import assert from "node:assert/strict";
import { X12_850 } from "@/lib/edi/schemas/x12/850";
import type { SchemaNode } from "@/lib/schema/types";
import { generateEdiPreview } from "./generateEdiPreview";
import { makeConstRef, type MappingEdge } from "./types";

function jsonTree(): SchemaNode {
  return {
    id: "root",
    label: "json",
    path: "root",
    kind: "object",
    meta: { source: "json" },
    children: [
      {
        id: "root.Header",
        label: "Header",
        path: "root.Header",
        kind: "object",
        meta: { source: "json" },
        children: [
          { id: "root.Header.PoNumber", label: "PoNumber", path: "root.Header.PoNumber", kind: "leaf", dataType: "string", meta: { source: "json" } },
          { id: "root.Header.BuyerName", label: "BuyerName", path: "root.Header.BuyerName", kind: "leaf", dataType: "string", meta: { source: "json" } },
          { id: "root.Header.OrderDate", label: "OrderDate", path: "root.Header.OrderDate", kind: "leaf", dataType: "date", meta: { source: "json" } },
        ],
      },
      {
        id: "root.Items",
        label: "Items",
        path: "root.Items",
        kind: "array",
        meta: { source: "json" },
        children: [
          { id: "root.Items.LineNumber", label: "LineNumber", path: "root.Items.LineNumber", kind: "leaf", dataType: "string", meta: { source: "json" } },
          { id: "root.Items.Qty", label: "Qty", path: "root.Items.Qty", kind: "leaf", dataType: "number", meta: { source: "json" } },
          { id: "root.Items.Uom", label: "Uom", path: "root.Items.Uom", kind: "leaf", dataType: "string", meta: { source: "json" } },
          { id: "root.Items.Sku", label: "Sku", path: "root.Items.Sku", kind: "leaf", dataType: "string", meta: { source: "json" } },
        ],
      },
    ],
  };
}

const mappings: MappingEdge[] = [
  { id: "m1", sourceNodeId: "root.Header.PoNumber", targetNodeId: "root.header.BEG.BEG03" },
  { id: "m2", sourceNodeId: "root.Header.BuyerName", targetNodeId: "root.header.N1.N102" },
  { id: "m3", sourceNodeId: "root.Header.OrderDate", targetNodeId: "root.header.BEG.BEG05" },
  { id: "m4", sourceNodeId: "root.Items.LineNumber", targetNodeId: "root.PO1Loop[].PO1.PO101" },
  { id: "m5", sourceNodeId: "root.Items.Qty", targetNodeId: "root.PO1Loop[].PO1.PO102" },
  { id: "m6", sourceNodeId: "root.Items.Uom", targetNodeId: "root.PO1Loop[].PO1.PO103" },
  { id: "m7", sourceNodeId: "root.Items.Sku", targetNodeId: "root.PO1Loop[].PO1.PO108" },
];

const payload = {
  Header: { PoNumber: "PO-1001", BuyerName: "Acme Corp", OrderDate: "20260815" },
  Items: [
    { LineNumber: "1", Qty: 4, Uom: "EA", Sku: "SKU-1" },
    { LineNumber: "2", Qty: 2, Uom: "EA", Sku: "SKU-2" },
  ],
};

test("generateEdiPreview: header, repeating loop, and trailer with no issues", () => {
  const result = generateEdiPreview(X12_850, jsonTree(), mappings, payload);

  assert.deepEqual(result.issues, []);
  assert.equal(result.segments.length, 6); // BEG, N1, PO1x2, CTT, SE

  const [beg, n1, po1a, po1b, ctt, se] = result.segments;
  assert.equal(beg, "BEG*00*NE*PO-1001**20260815~");
  assert.equal(n1, "N1*BY*Acme Corp~");
  assert.equal(po1a, "PO1*1*4*EA****VP*SKU-1~");
  assert.equal(po1b, "PO1*2*2*EA****VP*SKU-2~");
  assert.equal(ctt, "CTT*2~"); // loopInstanceCount derived value
  assert.equal(se, "SE*7*0001~"); // segmentCount derived value (approximate, +1 for unmodeled ST) + placeholder control number
});

test("generateEdiPreview: unmapped required elements are reported as errors, not thrown", () => {
  const partialMappings = mappings.filter((m) => m.targetNodeId !== "root.header.BEG.BEG03");
  const result = generateEdiPreview(X12_850, jsonTree(), partialMappings, payload);

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].severity, "error");
  assert.equal(result.issues[0].scope, "structural");
  assert.match(result.issues[0].message, /BEG03/);
  assert.equal(result.segments[0], "BEG*00*NE***20260815~"); // BEG03 left blank
});

test("generateEdiPreview: no source array data yields zero loop instances and a warning", () => {
  const result = generateEdiPreview(X12_850, jsonTree(), mappings, { Header: payload.Header, Items: [] });

  assert.equal(result.segments.length, 4); // BEG, N1, CTT, SE — no PO1 instances
  assert.ok(result.issues.some((i) => i.severity === "warning" && i.message.includes("PO1Loop")));
  assert.equal(result.segments[2], "CTT*0~");
});

test("generateEdiPreview: value exceeding max length is flagged as a data error", () => {
  const overlong = {
    Header: { ...payload.Header, BuyerName: "A".repeat(70) }, // N102 maxLength is 60
    Items: payload.Items,
  };
  const result = generateEdiPreview(X12_850, jsonTree(), mappings, overlong);

  const issue = result.issues.find((i) => i.message.includes("N102") && i.message.includes("max length"));
  assert.ok(issue, "expected a max-length issue for N102");
  assert.equal(issue?.severity, "error");
  assert.equal(issue?.scope, "data");
});

test("generateEdiPreview: malformed numeric value is flagged as a data warning", () => {
  const badQty = {
    Header: payload.Header,
    Items: [{ LineNumber: "1", Qty: "four", Uom: "EA", Sku: "SKU-1" }],
  };
  const result = generateEdiPreview(X12_850, jsonTree(), mappings, badQty);

  const issue = result.issues.find((i) => i.message.includes("PO102") && i.message.includes("valid N0"));
  assert.ok(issue, "expected a format issue for PO102");
  assert.equal(issue?.severity, "warning");
  assert.match(issue?.message ?? "", /^Item 1:/);
});

test("generateEdiPreview: loop On Begin rule skips an instance (BRD Use Case 1)", () => {
  const payloadWithZeroQty = {
    Header: payload.Header,
    Items: [
      { LineNumber: "1", Qty: 4, Uom: "EA", Sku: "SKU-1" },
      { LineNumber: "2", Qty: 0, Uom: "EA", Sku: "SKU-2" }, // should be skipped
      { LineNumber: "3", Qty: 2, Uom: "EA", Sku: "SKU-3" },
    ],
  };
  const result = generateEdiPreview(X12_850, jsonTree(), mappings, payloadWithZeroQty, {
    nodeRules: { "root.PO1Loop[]": { onBegin: "IF #Qty == 0 THEN SKIP; END;" } },
  });

  assert.equal(result.segments.length, 6); // BEG, N1, PO1 x2 (SKU-2's instance skipped), CTT, SE
  assert.ok(result.segments.some((s) => s.includes("SKU-1")));
  assert.ok(result.segments.some((s) => s.includes("SKU-3")));
  assert.ok(!result.segments.some((s) => s.includes("SKU-2")));
});

test("generateEdiPreview: loop On End rule accumulates a global across iterations (BRD Use Case 2)", () => {
  const result = generateEdiPreview(X12_850, jsonTree(), mappings, payload, {
    globalVarDecls: [{ name: "TotalQty", type: "real", initialValue: "0" }],
    nodeRules: { "root.PO1Loop[]": { onEnd: "TotalQty = TotalQty + #Qty;" } },
  });

  assert.deepEqual(result.globals.TotalQty, { kind: "real", value: 6 }); // 4 + 2 across both items
});

test("generateEdiPreview: a global variable can be used as an EDI element's mapped source", () => {
  const mappingsWithGlobal: MappingEdge[] = [{ id: "g1", sourceNodeId: "$Global.OrderTotal", targetNodeId: "root.header.BEG.BEG03" }];
  const result = generateEdiPreview(X12_850, jsonTree(), mappingsWithGlobal, { Header: {}, Items: [] }, {
    globalVarDecls: [{ name: "OrderTotal", type: "real", initialValue: "274.49" }],
  });
  assert.ok(result.segments[0].includes("274.49"));
});

test("generateEdiPreview: a rule runtime error is reported, not thrown, and skips that instance", () => {
  const result = generateEdiPreview(X12_850, jsonTree(), mappings, payload, {
    nodeRules: { "root.PO1Loop[]": { onBegin: "Real x = 1 / 0;" } },
  });
  assert.equal(result.segments.length, 4); // BEG, N1, CTT, SE — both instances failed On Begin
  assert.ok(result.issues.some((i) => i.message.includes("On Begin rule error")));
});

test("generateEdiPreview: a single-field transform (Uppercase) is applied to the mapped value", () => {
  const mappingsWithTransform = mappings.map((m) =>
    m.targetNodeId === "root.PO1Loop[].PO1.PO108"
      ? { ...m, transform: { steps: [{ expression: "Uppercase(#value)", fieldArgs: [], summary: "UPPER(…)" }] } }
      : m
  );
  const lowerPayload = { Header: payload.Header, Items: [{ ...payload.Items[0], Sku: "sku-1" }] };
  const result = generateEdiPreview(X12_850, jsonTree(), mappingsWithTransform, lowerPayload);

  assert.ok(result.segments[2].includes("SKU-1"));
});

test("generateEdiPreview: a two-field arithmetic transform combines two mapped source fields", () => {
  const tree = jsonTree();
  const itemsNode = tree.children!.find((c) => c.id === "root.Items")!;
  itemsNode.children!.push({ id: "root.Items.Price", label: "Price", path: "root.Items.Price", kind: "leaf", dataType: "number", meta: { source: "json" } });

  const mappingsWithTransform: MappingEdge[] = mappings.map((m) =>
    m.targetNodeId === "root.PO1Loop[].PO1.PO102"
      ? { ...m, transform: { steps: [{ expression: "#value * #value2", fieldArgs: ["root.Items.Price"], summary: "… × Price" }] } }
      : m
  );

  const payloadWithPrice = {
    Header: payload.Header,
    Items: [{ LineNumber: "1", Qty: 4, Price: 2.5, Uom: "EA", Sku: "SKU-1" }],
  };
  const result = generateEdiPreview(X12_850, tree, mappingsWithTransform, payloadWithPrice);

  assert.ok(result.segments[2].includes("*10*")); // 4 * 2.5 = 10, in place of the raw Qty
});

test("generateEdiPreview: a transform expression error is reported, not thrown, and blanks that value", () => {
  const mappingsWithBadTransform = mappings.map((m) =>
    m.targetNodeId === "root.PO1Loop[].PO1.PO102"
      ? { ...m, transform: { steps: [{ expression: "#value / 0", fieldArgs: [], summary: "… ÷ 0" }] } }
      : m
  );
  const result = generateEdiPreview(X12_850, jsonTree(), mappingsWithBadTransform, payload);

  assert.ok(result.issues.some((i) => i.message.includes("PO102") && i.message.includes("transform")));
  assert.equal(result.segments[2], "PO1*1**EA****VP*SKU-1~"); // PO102 left blank
});

test("generateEdiPreview: a constant-value mapping has no source field, just a fixed value", () => {
  // PO104 (Unit Price) has neither a schema fixedValue nor a mapping in the base
  // fixture — a clean target to prove a constant mapping works with no source field.
  const mappingsWithConstant: MappingEdge[] = [
    ...mappings,
    { id: "const1", sourceNodeId: makeConstRef("9.99"), targetNodeId: "root.PO1Loop[].PO1.PO104" },
  ];
  const result = generateEdiPreview(X12_850, jsonTree(), mappingsWithConstant, payload);

  assert.equal(result.segments[2], "PO1*1*4*EA*9.99***VP*SKU-1~");
  assert.equal(result.segments[3], "PO1*2*2*EA*9.99***VP*SKU-2~"); // same constant on every loop instance
});

test("generateEdiPreview: a chained transform runs each step on the previous step's output", () => {
  const mappingsWithChain = mappings.map((m) =>
    m.targetNodeId === "root.PO1Loop[].PO1.PO108"
      ? {
          ...m,
          transform: {
            steps: [
              { expression: "Trim(#value)", fieldArgs: [], summary: "Trim(…)" },
              { expression: "Uppercase(#value)", fieldArgs: [], summary: "UPPER(…)" },
            ],
          },
        }
      : m
  );
  const spacedPayload = { Header: payload.Header, Items: [{ ...payload.Items[0], Sku: "  sku-1  " }] };
  const result = generateEdiPreview(X12_850, jsonTree(), mappingsWithChain, spacedPayload);

  assert.ok(result.segments[2].includes("SKU-1"));
});

test("generateEdiPreview: a conditional (IF/THEN/ELSE) transform step picks the right branch", () => {
  const mappingsWithConditional = mappings.map((m) =>
    m.targetNodeId === "root.PO1Loop[].PO1.PO103"
      ? {
          ...m,
          transform: {
            steps: [{ expression: 'IF #value == "EA" THEN "EACH" ELSE #value END', fieldArgs: [], summary: 'IF … = "EA" THEN "EACH"' }],
          },
        }
      : m
  );
  const result = generateEdiPreview(X12_850, jsonTree(), mappingsWithConditional, payload);

  assert.ok(result.segments[2].includes("EACH")); // both items have Uom "EA" in the fixture
  assert.ok(result.segments[3].includes("EACH"));
});

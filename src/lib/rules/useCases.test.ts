import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRule } from "./interpreter";
import type { RuleValue } from "./types";

// BRD "Custom Integration Tool - Extended Rules Engine", section 3, Use Case 1:
// On Begin of the target block, skip a repeating N1 instance unless N101 == "ST".
test("Use Case 1: conditional group mapping (qualifier-based skip)", () => {
  const onBeginRule = 'IF #N101 == "ST" THEN Out = #N101; ELSE SKIP; END;';
  const instances = [{ N101: "BY", N102: "Buyer Corp" }, { N101: "ST", N102: "Ship-To Corp" }, { N101: "SF", N102: "Ship-From Corp" }];

  const kept: unknown[] = [];
  for (const instance of instances) {
    const globals = new Map<string, RuleValue>([["Out", { kind: "string", value: "" }]]);
    const result = evaluateRule(onBeginRule, { current: instance, root: {}, globals });
    if (!result.skip) kept.push(instance);
  }

  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0], { N101: "ST", N102: "Ship-To Corp" });
});

// Use Case 2: On End of the repeating line-item block, accumulate a running total in
// a map-level global variable, then read it once after the loop for the summary segment.
test("Use Case 2: accumulator / running total across loop iterations", () => {
  const onEndRule = "GlobalTotal = GlobalTotal + #LinePrice;";
  const lineItems = [{ LinePrice: 19.99 }, { LinePrice: 249.0 }, { LinePrice: 5.5 }];

  const globals = new Map<string, RuleValue>([["GlobalTotal", { kind: "real", value: 0 }]]);
  for (const item of lineItems) {
    const result = evaluateRule(onEndRule, { current: item, root: {}, globals });
    assert.equal(result.error, undefined);
  }

  const total = globals.get("GlobalTotal");
  assert.equal(total?.kind, "real");
  assert.ok(total && Math.abs(total.value - 274.49) < 1e-9);
});

test("Use Case 2 variant: accumulator persists across iterations even when interleaved with other rules", () => {
  const onEndRule = "GlobalTotal = GlobalTotal + #LinePrice;";
  const globals = new Map<string, RuleValue>([
    ["GlobalTotal", { kind: "real", value: 0 }],
    ["LastSku", { kind: "string", value: "" }],
  ]);
  const lineItems = [
    { Sku: "SKU-1", LinePrice: 10 },
    { Sku: "SKU-2", LinePrice: 20 },
  ];

  for (const item of lineItems) {
    evaluateRule(onEndRule, { current: item, root: {}, globals });
    evaluateRule("LastSku = #Sku;", { current: item, root: {}, globals });
  }

  assert.deepEqual(globals.get("GlobalTotal"), { kind: "real", value: 30 });
  assert.deepEqual(globals.get("LastSku"), { kind: "string", value: "SKU-2" });
});

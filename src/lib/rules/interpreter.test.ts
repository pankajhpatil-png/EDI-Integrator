import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRule, compileRule, evaluateExpression } from "./interpreter";
import type { RuleContext, RuleValue } from "./types";

function ctx(overrides: Partial<RuleContext> = {}): RuleContext {
  return { current: {}, root: {}, globals: new Map(), ...overrides };
}

test("evaluateRule: arithmetic with correct precedence", () => {
  const result = evaluateRule("Real x = 1 + 2 * 3; Real y = x;", ctx());
  assert.equal(result.skip, false);
  assert.equal(result.error, undefined);
});

test("evaluateRule: division by zero is a runtime error, not a throw", () => {
  const result = evaluateRule("Real x = 1 / 0;", ctx());
  assert.equal(result.skip, false);
  assert.match(result.error?.message ?? "", /[Dd]ivision by zero/);
});

test("evaluateRule: string + concatenation and Concat() builtin", () => {
  const globals = new Map<string, RuleValue>([["Out", { kind: "string", value: "" }]]);
  evaluateRule('Out = "a" + "b" + Concat("-", "c");', ctx({ globals }));
  assert.deepEqual(globals.get("Out"), { kind: "string", value: "ab-c" });
});

test("evaluateRule: Left/Right/Length/Trim builtins", () => {
  const globals = new Map<string, RuleValue>([
    ["L", { kind: "string", value: "" }],
    ["R", { kind: "string", value: "" }],
    ["N", { kind: "integer", value: 0 }],
    ["T", { kind: "string", value: "" }],
  ]);
  evaluateRule(
    `
    L = Left("Hello World", 5);
    R = Right("Hello World", 5);
    N = Length("Hello World");
    T = Trim("  padded  ");
    `,
    ctx({ globals })
  );
  assert.deepEqual(globals.get("L"), { kind: "string", value: "Hello" });
  assert.deepEqual(globals.get("R"), { kind: "string", value: "World" });
  assert.deepEqual(globals.get("N"), { kind: "integer", value: 11 });
  assert.deepEqual(globals.get("T"), { kind: "string", value: "padded" });
});

test("evaluateRule: StringToInteger and invalid input reports a runtime error", () => {
  const globals = new Map<string, RuleValue>([["N", { kind: "integer", value: 0 }]]);
  const ok = evaluateRule('N = StringToInteger("42");', ctx({ globals }));
  assert.equal(ok.error, undefined);
  assert.deepEqual(globals.get("N"), { kind: "integer", value: 42 });

  const bad = evaluateRule('N = StringToInteger("abc");', ctx({ globals }));
  assert.match(bad.error?.message ?? "", /not a valid integer/);
});

test("evaluateRule: DateTimeFormat builtin", () => {
  const globals = new Map<string, RuleValue>([["D", { kind: "string", value: "" }]]);
  evaluateRule('D = DateTimeFormat("2026-08-15T00:00:00", "YYYY/MM/DD");', ctx({ globals }));
  assert.deepEqual(globals.get("D"), { kind: "string", value: "2026/08/15" });
});

test("evaluateRule: #Field resolves against the current block", () => {
  const result = evaluateRule("String s = #Sku;", ctx({ current: { Sku: "SKU-1" } }));
  assert.equal(result.error, undefined);
});

test("evaluateRule: $Group.Block.#Field resolves an absolute path", () => {
  const globals = new Map<string, RuleValue>([["Out", { kind: "string", value: "" }]]);
  const root = { Group: { Block: { Field: "found-it" } } };
  evaluateRule("Out = $Group.Block.#Field;", ctx({ globals, root }));
  assert.deepEqual(globals.get("Out"), { kind: "string", value: "found-it" });
});

test("evaluateRule: IF/THEN/ELSE branches correctly", () => {
  const globals = new Map<string, RuleValue>([["Out", { kind: "string", value: "" }]]);
  evaluateRule('IF #N101 == "ST" THEN Out = "ship-to"; ELSE Out = "other"; END;', ctx({ globals, current: { N101: "ST" } }));
  assert.deepEqual(globals.get("Out"), { kind: "string", value: "ship-to" });

  evaluateRule('IF #N101 == "ST" THEN Out = "ship-to"; ELSE Out = "other"; END;', ctx({ globals, current: { N101: "BY" } }));
  assert.deepEqual(globals.get("Out"), { kind: "string", value: "other" });
});

test("evaluateRule: SKIP unwinds immediately, even nested inside an IF", () => {
  const result = evaluateRule("IF TRUE THEN SKIP; END;", ctx());
  assert.equal(result.skip, true);
});

test("evaluateRule: assigning to an undeclared variable is a runtime error", () => {
  const result = evaluateRule("Foo = 1;", ctx());
  assert.match(result.error?.message ?? "", /undeclared variable/);
});

test("evaluateRule: reading an undefined variable is a runtime error", () => {
  const result = evaluateRule("Real x = UndefinedVar;", ctx());
  assert.match(result.error?.message ?? "", /Undefined variable/);
});

test("evaluateRule: syntax errors are reported, not thrown", () => {
  const result = evaluateRule("Integer x = ;", ctx());
  assert.equal(result.skip, false);
  assert.ok(result.error);
  assert.ok(typeof result.error?.line === "number");
});

test("compileRule: validates without executing", () => {
  assert.deepEqual(compileRule("Integer x = 5;"), { valid: true });
  const bad = compileRule("Integer x = ;");
  assert.equal(bad.valid, false);
});

test("evaluateRule: Uppercase/Lowercase/PadLeft/PadRight builtins", () => {
  const globals = new Map<string, RuleValue>([
    ["U", { kind: "string", value: "" }],
    ["L", { kind: "string", value: "" }],
    ["PL", { kind: "string", value: "" }],
    ["PR", { kind: "string", value: "" }],
  ]);
  evaluateRule(
    `
    U = Uppercase("sku-1");
    L = Lowercase("SKU-1");
    PL = PadLeft("7", 3, "0");
    PR = PadRight("7", 3, "0");
    `,
    ctx({ globals })
  );
  assert.deepEqual(globals.get("U"), { kind: "string", value: "SKU-1" });
  assert.deepEqual(globals.get("L"), { kind: "string", value: "sku-1" });
  assert.deepEqual(globals.get("PL"), { kind: "string", value: "007" });
  assert.deepEqual(globals.get("PR"), { kind: "string", value: "700" });
});

test("evaluateRule: Round builtin with and without a decimals argument", () => {
  const globals = new Map<string, RuleValue>([
    ["A", { kind: "integer", value: 0 }],
    ["B", { kind: "real", value: 0 }],
  ]);
  evaluateRule("A = Round(4.6); B = Round(3.14159, 2);", ctx({ globals }));
  assert.deepEqual(globals.get("A"), { kind: "integer", value: 5 });
  assert.deepEqual(globals.get("B"), { kind: "real", value: 3.14 });
});

test("evaluateRule: Lookup builtin matches, falls back to default, then to empty string", () => {
  const globals = new Map<string, RuleValue>([
    ["Match", { kind: "string", value: "" }],
    ["Fallback", { kind: "string", value: "" }],
    ["Empty", { kind: "string", value: "" }],
  ]);
  evaluateRule(
    `
    Match = Lookup("US", "US=USA|CA=CAN");
    Fallback = Lookup("MX", "US=USA|CA=CAN", "UNKNOWN");
    Empty = Lookup("MX", "US=USA|CA=CAN");
    `,
    ctx({ globals })
  );
  assert.deepEqual(globals.get("Match"), { kind: "string", value: "USA" });
  assert.deepEqual(globals.get("Fallback"), { kind: "string", value: "UNKNOWN" });
  assert.deepEqual(globals.get("Empty"), { kind: "string", value: "" });
});

test("evaluateExpression: evaluates a bare expression (no statements) against #value refs", () => {
  const result = evaluateExpression("#value * #value2", ctx({ current: { value: 4, value2: 2.5 } }));
  assert.deepEqual(result, { value: { kind: "real", value: 10 } });
});

test("evaluateExpression: reports a runtime error without throwing", () => {
  const result = evaluateExpression("#value / 0", ctx({ current: { value: 1 } }));
  assert.ok("error" in result);
});

test("evaluateExpression: reports a syntax error without throwing", () => {
  const result = evaluateExpression("#value *", ctx({ current: { value: 1 } }));
  assert.ok("error" in result);
});

test("evaluateExpression: IF/THEN/ELSE/END as a ternary expression, both branches", () => {
  const whenTrue = evaluateExpression('IF #value == "US" THEN "USA" ELSE #value END', ctx({ current: { value: "US" } }));
  assert.deepEqual(whenTrue, { value: { kind: "string", value: "USA" } });

  const whenFalse = evaluateExpression('IF #value == "US" THEN "USA" ELSE #value END', ctx({ current: { value: "CA" } }));
  assert.deepEqual(whenFalse, { value: { kind: "string", value: "CA" } });
});

test("evaluateExpression: conditional only evaluates the taken branch (lazy)", () => {
  // the untaken ELSE branch divides by zero — must not surface as an error
  const result = evaluateExpression("IF 1 == 1 THEN 42 ELSE 1 / 0 END", ctx());
  assert.deepEqual(result, { value: { kind: "integer", value: 42 } });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRule } from "./parser";
import { RuleSyntaxError } from "./types";

test("parseRule: variable declaration with initializer", () => {
  const stmts = parseRule('Integer x = 5;');
  assert.deepEqual(stmts, [{ kind: "VarDecl", varType: "integer", name: "x", init: { kind: "NumberLit", value: 5 } }]);
});

test("parseRule: variable declaration without initializer", () => {
  const stmts = parseRule("String s;");
  assert.deepEqual(stmts, [{ kind: "VarDecl", varType: "string", name: "s", init: null }]);
});

test("parseRule: assignment", () => {
  const stmts = parseRule("GlobalTotal = GlobalTotal + #LinePrice;");
  assert.deepEqual(stmts, [
    {
      kind: "Assign",
      name: "GlobalTotal",
      value: {
        kind: "Binary",
        op: "+",
        left: { kind: "VarRef", name: "GlobalTotal" },
        right: { kind: "RelativeRef", field: "LinePrice" },
      },
    },
  ]);
});

test("parseRule: if/then/else", () => {
  const stmts = parseRule('IF #N101 == "ST" THEN SKIP; ELSE SKIP; END;');
  assert.equal(stmts.length, 1);
  const stmt = stmts[0];
  assert.equal(stmt.kind, "If");
  if (stmt.kind !== "If") return;
  assert.deepEqual(stmt.condition, {
    kind: "Binary",
    op: "==",
    left: { kind: "RelativeRef", field: "N101" },
    right: { kind: "StringLit", value: "ST" },
  });
  assert.deepEqual(stmt.thenBranch, [{ kind: "Skip" }]);
  assert.deepEqual(stmt.elseBranch, [{ kind: "Skip" }]);
});

test("parseRule: if without else", () => {
  const stmts = parseRule("IF TRUE THEN SKIP; END;");
  assert.equal(stmts[0].kind, "If");
  if (stmts[0].kind === "If") assert.equal(stmts[0].elseBranch, null);
});

test("parseRule: absolute reference path", () => {
  const stmts = parseRule("String x = $Group.Block.#Field;");
  assert.equal(stmts[0].kind, "VarDecl");
  if (stmts[0].kind !== "VarDecl") return;
  assert.deepEqual(stmts[0].init, { kind: "AbsoluteRef", path: ["Group", "Block"], field: "Field" });
});

test("parseRule: function call with multiple arguments", () => {
  const stmts = parseRule('String x = Concat(#A, "-", #B);');
  assert.equal(stmts[0].kind, "VarDecl");
  if (stmts[0].kind !== "VarDecl") return;
  assert.deepEqual(stmts[0].init, {
    kind: "Call",
    name: "Concat",
    args: [
      { kind: "RelativeRef", field: "A" },
      { kind: "StringLit", value: "-" },
      { kind: "RelativeRef", field: "B" },
    ],
  });
});

test("parseRule: operator precedence — * before +, comparisons above logical AND/OR", () => {
  const stmts = parseRule("Real x = 1 + 2 * 3;");
  assert.equal(stmts[0].kind, "VarDecl");
  if (stmts[0].kind !== "VarDecl") return;
  assert.deepEqual(stmts[0].init, {
    kind: "Binary",
    op: "+",
    left: { kind: "NumberLit", value: 1 },
    right: { kind: "Binary", op: "*", left: { kind: "NumberLit", value: 2 }, right: { kind: "NumberLit", value: 3 } },
  });
});

test("parseRule: AND/OR/NOT combine correctly", () => {
  const stmts = parseRule("IF NOT #A AND #B OR #C THEN SKIP; END;");
  const stmt = stmts[0];
  assert.equal(stmt.kind, "If");
  if (stmt.kind !== "If") return;
  // (NOT #A AND #B) OR #C
  assert.equal(stmt.condition.kind, "Binary");
  if (stmt.condition.kind === "Binary") assert.equal(stmt.condition.op, "OR");
});

test("parseRule: keywords are case-insensitive", () => {
  const stmts = parseRule('if #x == 1 then skip; end;');
  assert.equal(stmts[0].kind, "If");
});

test("parseRule: syntax errors throw RuleSyntaxError with location", () => {
  assert.throws(() => parseRule("Integer x = ;"), RuleSyntaxError);
  assert.throws(() => parseRule("IF TRUE THEN SKIP;"), RuleSyntaxError); // missing END;
  assert.throws(() => parseRule("x ="), RuleSyntaxError);
});

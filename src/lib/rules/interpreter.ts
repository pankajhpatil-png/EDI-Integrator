import type { BinaryOp, Expr, Stmt } from "./ast";
import { parseExpression, parseRule } from "./parser";
import { RuleRuntimeError, RuleSyntaxError, type DeclaredType, type RuleContext, type RuleResult, type RuleValue } from "./types";

// A thrown control-flow signal, not a real error — SKIP unwinds straight out of the
// current rule regardless of nesting (inside an IF, etc.), matching "skip the
// instance" from BRD Use Case 1.
class SkipSignal {}

function getField(obj: unknown, field: string): unknown {
  if (obj === null || typeof obj !== "object") return undefined;
  return (obj as Record<string, unknown>)[field];
}

function getAtPath(root: unknown, path: string[]): unknown {
  let current = root;
  for (const segment of path) current = getField(current, segment);
  return current;
}

function toRuleValue(raw: unknown): RuleValue {
  if (raw === null || raw === undefined) return { kind: "null", value: null };
  if (typeof raw === "boolean") return { kind: "boolean", value: raw };
  if (typeof raw === "number") return { kind: Number.isInteger(raw) ? "integer" : "real", value: raw };
  return { kind: "string", value: String(raw) };
}

function defaultForType(type: DeclaredType): RuleValue {
  if (type === "integer") return { kind: "integer", value: 0 };
  if (type === "real") return { kind: "real", value: 0 };
  if (type === "datetime") return { kind: "datetime", value: "" };
  return { kind: "string", value: "" };
}

function describe(v: RuleValue): string {
  return `${v.kind}(${JSON.stringify(v.value)})`;
}

function isNumeric(v: RuleValue): v is Extract<RuleValue, { kind: "integer" | "real" }> {
  return v.kind === "integer" || v.kind === "real";
}

function isStringy(v: RuleValue): v is Extract<RuleValue, { kind: "string" | "datetime" }> {
  return v.kind === "string" || v.kind === "datetime";
}

function asNumber(v: RuleValue): number {
  if (isNumeric(v)) return v.value;
  if (v.kind === "string") {
    const n = Number(v.value);
    if (!Number.isNaN(n) && v.value.trim() !== "") return n;
  }
  throw new RuleRuntimeError(`Expected a number, got ${describe(v)}.`);
}

function asString(v: RuleValue): string {
  if (isStringy(v)) return v.value;
  if (isNumeric(v)) return String(v.value);
  if (v.kind === "boolean") return v.value ? "TRUE" : "FALSE";
  return "";
}

// Public — lets a caller outside the interpreter (e.g. the transformation engine
// reading a "$Global.Name" mapping source) render a RuleValue the same way rules do.
export function ruleValueToString(v: RuleValue | undefined): string {
  return v ? asString(v) : "";
}

function truthy(v: RuleValue): boolean {
  if (v.kind === "boolean") return v.value;
  if (isNumeric(v)) return v.value !== 0;
  if (isStringy(v)) return v.value.length > 0;
  return false;
}

function numericKind(a: RuleValue, b: RuleValue): "integer" | "real" {
  return a.kind === "integer" && b.kind === "integer" ? "integer" : "real";
}

function compareEq(a: RuleValue, b: RuleValue): boolean {
  if (isNumeric(a) && isNumeric(b)) return asNumber(a) === asNumber(b);
  if (a.kind === "boolean" || b.kind === "boolean") return truthy(a) === truthy(b);
  return asString(a) === asString(b);
}

function compareOrd(a: RuleValue, b: RuleValue): number {
  if (isNumeric(a) && isNumeric(b)) return asNumber(a) - asNumber(b);
  const sa = asString(a);
  const sb = asString(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function requireArgs(name: string, args: RuleValue[], count: number) {
  if (args.length !== count) throw new RuleRuntimeError(`${name}() expects ${count} argument(s), got ${args.length}.`);
}

// Minimal token substitution — YYYY/MM/DD/hh/mm/ss — not a full format spec, but
// covers the common cases without pulling in a date-formatting dependency.
function formatDateTime(raw: string, format: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new RuleRuntimeError(`DateTimeFormat: "${raw}" is not a valid date/time.`);
  const pad = (n: number) => String(n).padStart(2, "0");
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/hh/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()));
}

const BUILTINS: Record<string, (args: RuleValue[]) => RuleValue> = {
  Left: (args) => {
    requireArgs("Left", args, 2);
    return { kind: "string", value: asString(args[0]).slice(0, asNumber(args[1])) };
  },
  Right: (args) => {
    requireArgs("Right", args, 2);
    const s = asString(args[0]);
    const n = asNumber(args[1]);
    return { kind: "string", value: s.slice(Math.max(0, s.length - n)) };
  },
  Length: (args) => {
    requireArgs("Length", args, 1);
    return { kind: "integer", value: asString(args[0]).length };
  },
  Concat: (args) => ({ kind: "string", value: args.map(asString).join("") }),
  Trim: (args) => {
    requireArgs("Trim", args, 1);
    return { kind: "string", value: asString(args[0]).trim() };
  },
  StringToInteger: (args) => {
    requireArgs("StringToInteger", args, 1);
    const raw = asString(args[0]).trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) throw new RuleRuntimeError(`StringToInteger: "${raw}" is not a valid integer.`);
    return { kind: "integer", value: Math.trunc(n) };
  },
  DateTimeFormat: (args) => {
    requireArgs("DateTimeFormat", args, 2);
    return { kind: "string", value: formatDateTime(asString(args[0]), asString(args[1])) };
  },
  Uppercase: (args) => {
    requireArgs("Uppercase", args, 1);
    return { kind: "string", value: asString(args[0]).toUpperCase() };
  },
  Lowercase: (args) => {
    requireArgs("Lowercase", args, 1);
    return { kind: "string", value: asString(args[0]).toLowerCase() };
  },
  PadLeft: (args) => {
    requireArgs("PadLeft", args, 3);
    return { kind: "string", value: asString(args[0]).padStart(asNumber(args[1]), asString(args[2])) };
  },
  PadRight: (args) => {
    requireArgs("PadRight", args, 3);
    return { kind: "string", value: asString(args[0]).padEnd(asNumber(args[1]), asString(args[2])) };
  },
  Round: (args) => {
    if (args.length < 1 || args.length > 2) throw new RuleRuntimeError(`Round() expects 1 or 2 argument(s), got ${args.length}.`);
    const decimals = args.length === 2 ? asNumber(args[1]) : 0;
    const factor = 10 ** decimals;
    const value = Math.round(asNumber(args[0]) * factor) / factor;
    return { kind: decimals > 0 ? "real" : "integer", value };
  },
  // A small inline translation table — "US=USA|CA=CAN" — rather than a separate
  // lookup-table feature elsewhere in the tool; keeps a code translation
  // (country/UOM/qualifier) self-contained on the one mapping edge that needs it.
  Lookup: (args) => {
    if (args.length < 2 || args.length > 3) throw new RuleRuntimeError(`Lookup() expects 2 or 3 argument(s), got ${args.length}.`);
    const key = asString(args[0]);
    const table = asString(args[1]);
    const entry = table
      .split("|")
      .map((pair) => pair.split("="))
      .find(([k]) => k?.trim() === key);
    if (entry) return { kind: "string", value: (entry[1] ?? "").trim() };
    if (args.length === 3) return args[2];
    return { kind: "string", value: "" };
  },
};

class Interpreter {
  private locals = new Map<string, RuleValue>();
  constructor(private ctx: RuleContext) {}

  run(statements: Stmt[]) {
    this.execBlock(statements);
  }

  private execBlock(statements: Stmt[]) {
    for (const stmt of statements) this.execStmt(stmt);
  }

  private execStmt(stmt: Stmt) {
    switch (stmt.kind) {
      case "VarDecl": {
        const value = stmt.init ? this.evalExpr(stmt.init) : defaultForType(stmt.varType);
        this.locals.set(stmt.name, value);
        return;
      }
      case "Assign": {
        const value = this.evalExpr(stmt.value);
        if (this.locals.has(stmt.name)) {
          this.locals.set(stmt.name, value);
          return;
        }
        if (this.ctx.globals.has(stmt.name)) {
          this.ctx.globals.set(stmt.name, value);
          return;
        }
        throw new RuleRuntimeError(`Cannot assign to undeclared variable "${stmt.name}".`);
      }
      case "If": {
        if (truthy(this.evalExpr(stmt.condition))) this.execBlock(stmt.thenBranch);
        else if (stmt.elseBranch) this.execBlock(stmt.elseBranch);
        return;
      }
      case "Skip":
        throw new SkipSignal();
      case "ExprStmt":
        this.evalExpr(stmt.expr);
        return;
    }
  }

  // Public — mapping-edge transforms (a bare expression, no statements) evaluate
  // through this directly rather than via run()/execStmt().
  evalExpr(expr: Expr): RuleValue {
    switch (expr.kind) {
      case "NumberLit":
        return { kind: Number.isInteger(expr.value) ? "integer" : "real", value: expr.value };
      case "StringLit":
        return { kind: "string", value: expr.value };
      case "BoolLit":
        return { kind: "boolean", value: expr.value };
      case "RelativeRef":
        return toRuleValue(getField(this.ctx.current, expr.field));
      case "AbsoluteRef":
        return toRuleValue(getField(getAtPath(this.ctx.root, expr.path), expr.field));
      case "VarRef": {
        if (this.locals.has(expr.name)) return this.locals.get(expr.name)!;
        if (this.ctx.globals.has(expr.name)) return this.ctx.globals.get(expr.name)!;
        throw new RuleRuntimeError(`Undefined variable "${expr.name}".`);
      }
      case "Call": {
        const fn = BUILTINS[expr.name];
        if (!fn) throw new RuleRuntimeError(`Unknown function "${expr.name}".`);
        return fn(expr.args.map((a) => this.evalExpr(a)));
      }
      case "Unary": {
        const operand = this.evalExpr(expr.operand);
        if (expr.op === "-") return { kind: operand.kind === "integer" ? "integer" : "real", value: -asNumber(operand) };
        return { kind: "boolean", value: !truthy(operand) };
      }
      case "Binary":
        return this.evalBinary(expr.op, expr.left, expr.right);
      case "Conditional":
        // Lazy — only the taken branch is evaluated, so an error in the untaken
        // branch (e.g. a division by zero) never surfaces.
        return truthy(this.evalExpr(expr.condition)) ? this.evalExpr(expr.whenTrue) : this.evalExpr(expr.whenFalse);
    }
  }

  private evalBinary(op: BinaryOp, leftExpr: Expr, rightExpr: Expr): RuleValue {
    if (op === "AND") return { kind: "boolean", value: truthy(this.evalExpr(leftExpr)) && truthy(this.evalExpr(rightExpr)) };
    if (op === "OR") return { kind: "boolean", value: truthy(this.evalExpr(leftExpr)) || truthy(this.evalExpr(rightExpr)) };

    const left = this.evalExpr(leftExpr);
    const right = this.evalExpr(rightExpr);

    switch (op) {
      case "+":
        if (isStringy(left) || isStringy(right)) return { kind: "string", value: asString(left) + asString(right) };
        return { kind: numericKind(left, right), value: asNumber(left) + asNumber(right) };
      case "-":
        return { kind: numericKind(left, right), value: asNumber(left) - asNumber(right) };
      case "*":
        return { kind: numericKind(left, right), value: asNumber(left) * asNumber(right) };
      case "/": {
        const divisor = asNumber(right);
        if (divisor === 0) throw new RuleRuntimeError("Division by zero.");
        return { kind: "real", value: asNumber(left) / divisor };
      }
      case "==":
        return { kind: "boolean", value: compareEq(left, right) };
      case "!=":
        return { kind: "boolean", value: !compareEq(left, right) };
      case "<":
        return { kind: "boolean", value: compareOrd(left, right) < 0 };
      case "<=":
        return { kind: "boolean", value: compareOrd(left, right) <= 0 };
      case ">":
        return { kind: "boolean", value: compareOrd(left, right) > 0 };
      case ">=":
        return { kind: "boolean", value: compareOrd(left, right) >= 0 };
    }
  }
}

export function evaluateRule(source: string, context: RuleContext): RuleResult {
  let statements: Stmt[];
  try {
    statements = parseRule(source);
  } catch (e) {
    if (e instanceof RuleSyntaxError) return { skip: false, error: { message: e.message, line: e.line } };
    throw e;
  }

  try {
    new Interpreter(context).run(statements);
    return { skip: false };
  } catch (e) {
    if (e instanceof SkipSignal) return { skip: true };
    if (e instanceof RuleRuntimeError) return { skip: false, error: { message: e.message } };
    throw e;
  }
}

// A mapping-edge transform is a single expression (no VarDecl/If/Skip) — e.g.
// "Trim(#value)" or "#value * #value2" — evaluated against a context built from
// the mapped field(s) rather than a loop-body payload.
export function evaluateExpression(
  source: string,
  context: RuleContext
): { value: RuleValue } | { error: { message: string; line?: number } } {
  let expr: Expr;
  try {
    expr = parseExpression(source);
  } catch (e) {
    if (e instanceof RuleSyntaxError) return { error: { message: e.message, line: e.line } };
    throw e;
  }

  try {
    return { value: new Interpreter(context).evalExpr(expr) };
  } catch (e) {
    if (e instanceof RuleRuntimeError) return { error: { message: e.message } };
    throw e;
  }
}

// For the future "Compile/Validate" editor button — parses only, never executes.
export function compileRule(source: string): { valid: true } | { valid: false; message: string; line: number } {
  try {
    parseRule(source);
    return { valid: true };
  } catch (e) {
    if (e instanceof RuleSyntaxError) return { valid: false, message: e.message, line: e.line };
    throw e;
  }
}

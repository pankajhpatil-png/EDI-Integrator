// Runtime value representation for the Extended Rules DSL (BRD "Custom Integration
// Tool - Extended Rules Engine", section 2.2). Integer/Real are both plain JS numbers
// at runtime — the declared type only matters for VarDecl bookkeeping — and DateTime
// is kept as a string (no date arithmetic is specified, only DateTimeFormat()).
export type RuleValueKind = "integer" | "real" | "string" | "datetime" | "boolean" | "null";

export type RuleValue =
  | { kind: "integer" | "real"; value: number }
  | { kind: "string" | "datetime"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "null"; value: null };

export type DeclaredType = "integer" | "string" | "real" | "datetime";

// `current` backs #Field (relative to the block this rule is attached to — e.g. the
// current loop item); `root` backs $Group.Block.#Field (absolute path from the top of
// the payload). `globals` is a single Map shared and mutated across an entire
// transformation run, so an accumulator written in one loop iteration's On End rule is
// visible in the next iteration's, and after the loop ends.
export interface RuleContext {
  current: unknown;
  root: unknown;
  globals: Map<string, RuleValue>;
}

export interface RuleResult {
  skip: boolean;
  error?: { message: string; line?: number };
}

export class RuleSyntaxError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number
  ) {
    super(message);
  }
}

export class RuleRuntimeError extends Error {}

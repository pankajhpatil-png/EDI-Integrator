import type { MappingTransformStep } from "./types";

// The ƒx panel's function palette. Each function takes the current value at this
// step — the raw mapped value for a chain's first step, or the previous step's
// output for any step after — always arg index 0, "#value" — plus zero or more
// extra args: either a literal the user types, or another mapped field ("#value2",
// "#value3", ... — see fieldArgs on MappingTransformStep) for functions that
// combine two source fields into one target.
export type TransformArgKind = "field" | "literal-text" | "literal-number";

export interface TransformArgSpec {
  kind: TransformArgKind;
  label: string;
  defaultValue: string;
}

export interface TransformFunctionSpec {
  id: string;
  label: string;
  category: "string" | "arithmetic" | "conditional";
  args: TransformArgSpec[];
  // exprRefs[0] is always "#value"; exprRefs[i] for i>0 is "#value{i+1}" (field arg)
  // or the literal already formatted for the expression (quoted for text, bare for number).
  buildExpression: (exprRefs: string[]) => string;
  // labels[0] is the mapped source field's label; labels[i] for i>0 is either the
  // chosen second field's label or the raw literal the user typed.
  buildSummary: (labels: string[]) => string;
}

export const TRANSFORM_FUNCTIONS: TransformFunctionSpec[] = [
  {
    id: "uppercase",
    label: "Uppercase",
    category: "string",
    args: [],
    buildExpression: ([value]) => `Uppercase(${value})`,
    buildSummary: () => `UPPER(…)`,
  },
  {
    id: "lowercase",
    label: "Lowercase",
    category: "string",
    args: [],
    buildExpression: ([value]) => `Lowercase(${value})`,
    buildSummary: () => `lower(…)`,
  },
  {
    id: "trim",
    label: "Trim whitespace",
    category: "string",
    args: [],
    buildExpression: ([value]) => `Trim(${value})`,
    buildSummary: () => `Trim(…)`,
  },
  {
    id: "left",
    label: "Left (first N characters)",
    category: "string",
    args: [{ kind: "literal-number", label: "characters", defaultValue: "5" }],
    buildExpression: ([value, n]) => `Left(${value}, ${n})`,
    buildSummary: (labels) => `Left(…, ${labels[1]})`,
  },
  {
    id: "right",
    label: "Right (last N characters)",
    category: "string",
    args: [{ kind: "literal-number", label: "characters", defaultValue: "5" }],
    buildExpression: ([value, n]) => `Right(${value}, ${n})`,
    buildSummary: (labels) => `Right(…, ${labels[1]})`,
  },
  {
    id: "length",
    label: "Length",
    category: "string",
    args: [],
    buildExpression: ([value]) => `Length(${value})`,
    buildSummary: () => `Length(…)`,
  },
  {
    id: "concat-text",
    label: "Append text",
    category: "string",
    args: [{ kind: "literal-text", label: "text to append", defaultValue: "" }],
    buildExpression: ([value, text]) => `Concat(${value}, ${text})`,
    buildSummary: (labels) => `… + "${labels[1]}"`,
  },
  {
    id: "lookup",
    label: "Lookup / translate value",
    category: "string",
    args: [
      { kind: "literal-text", label: "table, e.g. US=USA|CA=CAN", defaultValue: "" },
      { kind: "literal-text", label: "default if no match (optional)", defaultValue: "" },
    ],
    buildExpression: ([value, table, fallback]) =>
      fallback === '""' ? `Lookup(${value}, ${table})` : `Lookup(${value}, ${table}, ${fallback})`,
    buildSummary: () => `Lookup(…)`,
  },
  {
    id: "concat-field",
    label: "Concat with another field",
    category: "string",
    args: [{ kind: "field", label: "second field", defaultValue: "" }],
    buildExpression: ([value, field]) => `Concat(${value}, ${field})`,
    buildSummary: (labels) => `… + ${labels[1]}`,
  },
  {
    id: "add-number",
    label: "Add a number",
    category: "arithmetic",
    args: [{ kind: "literal-number", label: "amount", defaultValue: "0" }],
    buildExpression: ([value, n]) => `${value} + ${n}`,
    buildSummary: (labels) => `… + ${labels[1]}`,
  },
  {
    id: "subtract-number",
    label: "Subtract a number",
    category: "arithmetic",
    args: [{ kind: "literal-number", label: "amount", defaultValue: "0" }],
    buildExpression: ([value, n]) => `${value} - ${n}`,
    buildSummary: (labels) => `… − ${labels[1]}`,
  },
  {
    id: "multiply-number",
    label: "Multiply by a number",
    category: "arithmetic",
    args: [{ kind: "literal-number", label: "factor", defaultValue: "1" }],
    buildExpression: ([value, n]) => `${value} * ${n}`,
    buildSummary: (labels) => `… × ${labels[1]}`,
  },
  {
    id: "divide-number",
    label: "Divide by a number",
    category: "arithmetic",
    args: [{ kind: "literal-number", label: "divisor", defaultValue: "1" }],
    buildExpression: ([value, n]) => `${value} / ${n}`,
    buildSummary: (labels) => `… ÷ ${labels[1]}`,
  },
  {
    id: "add-field",
    label: "Add another field",
    category: "arithmetic",
    args: [{ kind: "field", label: "second field", defaultValue: "" }],
    buildExpression: ([value, field]) => `${value} + ${field}`,
    buildSummary: (labels) => `… + ${labels[1]}`,
  },
  {
    id: "subtract-field",
    label: "Subtract another field",
    category: "arithmetic",
    args: [{ kind: "field", label: "second field", defaultValue: "" }],
    buildExpression: ([value, field]) => `${value} - ${field}`,
    buildSummary: (labels) => `… − ${labels[1]}`,
  },
  {
    id: "multiply-field",
    label: "Multiply by another field",
    category: "arithmetic",
    args: [{ kind: "field", label: "second field", defaultValue: "" }],
    buildExpression: ([value, field]) => `${value} * ${field}`,
    buildSummary: (labels) => `… × ${labels[1]}`,
  },
  {
    id: "divide-field",
    label: "Divide by another field",
    category: "arithmetic",
    args: [{ kind: "field", label: "second field", defaultValue: "" }],
    buildExpression: ([value, field]) => `${value} / ${field}`,
    buildSummary: (labels) => `… ÷ ${labels[1]}`,
  },
  {
    id: "round",
    label: "Round",
    category: "arithmetic",
    args: [{ kind: "literal-number", label: "decimal places", defaultValue: "2" }],
    buildExpression: ([value, n]) => `Round(${value}, ${n})`,
    buildSummary: (labels) => `Round(…, ${labels[1]})`,
  },
  {
    id: "if-equals-else-original",
    label: "If equals X, replace it — else leave as is",
    category: "conditional",
    args: [
      { kind: "literal-text", label: "compare to", defaultValue: "" },
      { kind: "literal-text", label: "replace with", defaultValue: "" },
    ],
    buildExpression: ([value, compare, replacement]) => `IF ${value} == ${compare} THEN ${replacement} ELSE ${value} END`,
    buildSummary: (labels) => `IF … = "${labels[1]}" THEN "${labels[2]}"`,
  },
  {
    id: "if-equals-else-fixed",
    label: "If equals X then A, else B",
    category: "conditional",
    args: [
      { kind: "literal-text", label: "compare to", defaultValue: "" },
      { kind: "literal-text", label: "then", defaultValue: "" },
      { kind: "literal-text", label: "else", defaultValue: "" },
    ],
    buildExpression: ([value, compare, whenTrue, whenFalse]) => `IF ${value} == ${compare} THEN ${whenTrue} ELSE ${whenFalse} END`,
    buildSummary: (labels) => `IF … = "${labels[1]}" THEN "${labels[2]}" ELSE "${labels[3]}"`,
  },
];

function quoteText(raw: string): string {
  return `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// Builds one persisted MappingTransformStep from a chosen function + the user's
// filled-in args. `argValues[i]` is a field's sourceNodeId for a "field" arg, raw
// text otherwise. `labelForField` resolves a field sourceNodeId to its display
// label for the summary. `primaryLabel` describes this step's own #value input —
// the mapped source field's label for a chain's first step, or something like
// "previous step's result" for any step after that.
export function buildTransformStep(
  spec: TransformFunctionSpec,
  argValues: string[],
  primaryLabel: string,
  labelForField: (sourceNodeId: string) => string
): MappingTransformStep {
  const fieldArgs: string[] = [];
  const exprRefs = ["#value"];
  const summaryLabels = [primaryLabel];

  spec.args.forEach((argSpec, i) => {
    const raw = argValues[i] ?? argSpec.defaultValue;
    if (argSpec.kind === "field") {
      fieldArgs.push(raw);
      exprRefs.push(`#value${fieldArgs.length + 1}`);
      summaryLabels.push(labelForField(raw));
    } else if (argSpec.kind === "literal-number") {
      exprRefs.push(String(Number(raw) || 0));
      summaryLabels.push(raw);
    } else {
      exprRefs.push(quoteText(raw));
      summaryLabels.push(raw);
    }
  });

  return {
    expression: spec.buildExpression(exprRefs),
    fieldArgs,
    summary: spec.buildSummary(summaryLabels),
  };
}

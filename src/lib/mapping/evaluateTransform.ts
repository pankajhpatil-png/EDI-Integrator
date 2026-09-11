import { evaluateExpression, ruleValueToString } from "@/lib/rules/interpreter";
import type { RuleValue } from "@/lib/rules/types";
import type { MappingTransformStep } from "./types";

export type TransformStepsResult = { value: string } | { error: string; failedStep: MappingTransformStep };

// Runs a transform's step chain in order, threading each step's output into the
// next step's #value — shared by generateEdiPreview (server-evaluated, real
// payload) and the ƒx panel's inline preview (client-evaluated, sample payload) so
// both compute a chained/conditional transform identically.
export function evaluateTransformSteps(
  steps: MappingTransformStep[],
  rawValue: string,
  resolveFieldArg: (sourceNodeId: string) => string,
  globals: Map<string, RuleValue>,
  root: unknown
): TransformStepsResult {
  let value = rawValue;
  for (const step of steps) {
    const current: Record<string, unknown> = { value };
    step.fieldArgs.forEach((fieldId, i) => {
      current[`value${i + 2}`] = resolveFieldArg(fieldId);
    });
    const result = evaluateExpression(step.expression, { current, root, globals });
    if ("error" in result) return { error: result.error.message, failedStep: step };
    value = ruleValueToString(result.value);
  }
  return { value };
}

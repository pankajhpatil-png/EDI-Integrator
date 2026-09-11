// One function/arithmetic/conditional step in a transform chain. `expression` is an
// Extended Rules DSL expression (e.g. "Trim(#value)", "#value * #value2", or
// 'IF #value == "US" THEN "USA" ELSE #value END') where #value is this step's own
// input — the raw mapped source for the first step, or the previous step's output
// for any step after it. #value2, #value3... are this step's own extra source
// fields, listed in `fieldArgs`, for functions that combine two mapped fields (e.g.
// Qty * Price -> LineTotal). Each step gets its own #value2.. numbering — they are
// NOT shared across steps — so chaining two two-field functions never collides.
export interface MappingTransformStep {
  expression: string;
  fieldArgs: string[];
  summary: string; // human-readable, e.g. "Trim(...)" or "x Price" — shown on the canvas
}

// An ordered chain of steps applied in sequence — step[0] runs on the raw mapped
// value, each subsequent step runs on the previous step's output. Most transforms
// are a single step; chaining (e.g. Trim then Uppercase) just appends another.
export interface MappingTransform {
  steps: MappingTransformStep[];
}

// One source per target (plus optional extra field args on each transform step) —
// many:1 mapping without a transform still isn't modeled; a source field may fan
// out to multiple targets, though.
export interface MappingEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  transform?: MappingTransform;
}

export function appendTransformStep(transform: MappingTransform | undefined, step: MappingTransformStep): MappingTransform {
  return { steps: [...(transform?.steps ?? []), step] };
}

export function removeTransformStep(transform: MappingTransform, index: number): MappingTransform | undefined {
  const steps = transform.steps.filter((_, i) => i !== index);
  return steps.length > 0 ? { steps } : undefined;
}

export function transformSummary(transform: MappingTransform): string {
  return transform.steps.map((s) => s.summary).join(" → ");
}

export function upsertMapping(mappings: MappingEdge[], sourceNodeId: string, targetNodeId: string): MappingEdge[] {
  const existing = mappings.find((m) => m.targetNodeId === targetNodeId);
  const withoutTarget = mappings.filter((m) => m.targetNodeId !== targetNodeId);
  return [...withoutTarget, { id: `${sourceNodeId}=>${targetNodeId}`, sourceNodeId, targetNodeId, transform: existing?.transform }];
}

export function removeMapping(mappings: MappingEdge[], edgeId: string): MappingEdge[] {
  return mappings.filter((m) => m.id !== edgeId);
}

export function setMappingTransform(
  mappings: MappingEdge[],
  targetNodeId: string,
  transform: MappingTransform | undefined
): MappingEdge[] {
  return mappings.map((m) => (m.targetNodeId === targetNodeId ? { ...m, transform } : m));
}

export function pruneMappingsForRemovedIds(mappings: MappingEdge[], removedIds: Set<string>): MappingEdge[] {
  return mappings
    .filter((m) => !removedIds.has(m.sourceNodeId) && !removedIds.has(m.targetNodeId))
    .map((m) =>
      m.transform?.steps.some((s) => s.fieldArgs.some((id) => removedIds.has(id))) ? { ...m, transform: undefined } : m
    );
}

// A constant mapping has no real source field — the target is always set to a fixed
// literal (e.g. BEG01 = "00"). Modeled the same way $Global.<name> is: a specially
// prefixed sourceNodeId rather than a second MappingEdge shape, so every existing
// consumer that just switches on sourceNodeId's prefix keeps working unchanged.
const CONST_REF_PREFIX = "$Const:";

export function isConstRef(sourceNodeId: string): boolean {
  return sourceNodeId.startsWith(CONST_REF_PREFIX);
}

export function constRefValue(sourceNodeId: string): string {
  return decodeURIComponent(sourceNodeId.slice(CONST_REF_PREFIX.length));
}

export function makeConstRef(value: string): string {
  return CONST_REF_PREFIX + encodeURIComponent(value);
}

export function upsertConstantMapping(mappings: MappingEdge[], targetNodeId: string, value: string): MappingEdge[] {
  return upsertMapping(mappings, makeConstRef(value), targetNodeId);
}

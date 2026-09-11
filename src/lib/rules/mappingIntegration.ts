import type { DeclaredType, RuleValue } from "./types";

// Map-level global variable declaration (BRD Use Case 2: "map-level global variable").
// initialValue is raw text as authored in the UI; parsed per declared type once per run.
export interface GlobalVarDecl {
  name: string;
  type: DeclaredType;
  initialValue: string;
}

// Rules attach to a "map component" (BRD 2.1) — for now, that's the EDI target's
// repeating body loop node id (e.g. "root.PO1Loop[]"), the only repeating block V1
// models. Keyed by that target SchemaNode id, mirroring how mappings/tree edits are
// already keyed by node id elsewhere rather than embedded in the tree itself.
export interface NodeRules {
  onBegin?: string;
  onEnd?: string;
}

// A MappingEdge.sourceNodeId of "$Global.<Name>" reads/writes a declared global
// instead of walking the JSON tree — reuses the same "$" convention rules already use
// for absolute field references, so the two concepts read consistently.
const GLOBAL_REF_PREFIX = "$Global.";

export function isGlobalRef(sourceNodeId: string): boolean {
  return sourceNodeId.startsWith(GLOBAL_REF_PREFIX);
}

export function globalRefName(sourceNodeId: string): string {
  return sourceNodeId.slice(GLOBAL_REF_PREFIX.length);
}

function parseInitialValue(type: DeclaredType, raw: string): RuleValue {
  if (type === "integer") {
    const n = Number(raw);
    return { kind: "integer", value: Number.isFinite(n) ? Math.trunc(n) : 0 };
  }
  if (type === "real") {
    const n = Number(raw);
    return { kind: "real", value: Number.isFinite(n) ? n : 0 };
  }
  if (type === "datetime") return { kind: "datetime", value: raw };
  return { kind: "string", value: raw };
}

export function buildInitialGlobals(decls: GlobalVarDecl[]): Map<string, RuleValue> {
  const globals = new Map<string, RuleValue>();
  for (const decl of decls) globals.set(decl.name, parseInitialValue(decl.type, decl.initialValue));
  return globals;
}

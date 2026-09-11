import type { SchemaNode } from "@/lib/schema/types";
import { pathFromRoot } from "@/lib/schema/treeOps";

// Walks the JSON tree's structural chain to a leaf, indexing into any array ancestor
// with `loopIndex` — works regardless of whether array node ids/paths carry a "[]"
// suffix, since it keys off each ancestor's actual `kind`, not string conventions.
// Shared by the EDI preview generator (server-evaluated) and the ƒx transform panel's
// inline preview (client-evaluated) so both resolve a mapped field's value identically.
export function resolveJsonValue(jsonRoot: SchemaNode, leafId: string, payload: unknown, loopIndex: number | null): string {
  const chain = pathFromRoot(jsonRoot, leafId);
  if (!chain) return "";
  let current: unknown = payload;
  for (const node of chain) {
    if (current === null || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[node.label];
    if (node.kind === "array") {
      if (!Array.isArray(current) || loopIndex === null) return "";
      current = current[loopIndex];
    }
  }
  return current === null || current === undefined ? "" : String(current);
}

export function resolveLoopArray(jsonRoot: SchemaNode, leafId: string, payload: unknown): unknown[] | null {
  const chain = pathFromRoot(jsonRoot, leafId);
  const arrayIndex = chain?.findIndex((n) => n.kind === "array") ?? -1;
  if (!chain || arrayIndex === -1) return null;
  let current: unknown = payload;
  for (let i = 0; i <= arrayIndex; i++) {
    if (current === null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[chain[i].label];
  }
  return Array.isArray(current) ? current : null;
}

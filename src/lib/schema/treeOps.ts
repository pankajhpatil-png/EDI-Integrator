import type { SchemaNode, SchemaNodeKind, LeafDataType } from "./types";

// Generic, immutable tree helpers — reused by the JSON "schema-as-you-go" authoring
// flow (add/rename/remove a target field on the fly, no sample JSON required).

export function findNode(root: SchemaNode, nodeId: string): SchemaNode | undefined {
  if (root.id === nodeId) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return undefined;
}

export function findByPath(root: SchemaNode, path: string): SchemaNode | undefined {
  if (root.path === path) return root;
  for (const child of root.children ?? []) {
    const found = findByPath(child, path);
    if (found) return found;
  }
  return undefined;
}

function mapTree(node: SchemaNode, fn: (n: SchemaNode) => SchemaNode): SchemaNode {
  const mapped = fn(node);
  if (!mapped.children) return mapped;
  return { ...mapped, children: mapped.children.map((c) => mapTree(c, fn)) };
}

export interface AddChildInput {
  name: string;
  type: LeafDataType | "object" | "array";
}

export function addChild(root: SchemaNode, parentId: string, input: AddChildInput): SchemaNode {
  const kind: SchemaNodeKind = input.type === "object" || input.type === "array" ? input.type : "leaf";
  return mapTree(root, (node) => {
    if (node.id !== parentId) return node;
    const childPath = `${node.path}.${input.name}`;
    const newChild: SchemaNode = {
      id: childPath,
      label: input.name,
      path: childPath,
      kind,
      dataType: kind === "leaf" ? (input.type as LeafDataType) : undefined,
      children: kind === "leaf" ? undefined : [],
      meta: { source: "json" },
    };
    return { ...node, children: [...(node.children ?? []), newChild] };
  });
}

export function removeNode(root: SchemaNode, nodeId: string): SchemaNode {
  function filterChildren(node: SchemaNode): SchemaNode {
    if (!node.children) return node;
    return {
      ...node,
      children: node.children.filter((c) => c.id !== nodeId).map(filterChildren),
    };
  }
  return filterChildren(root);
}

export function renameNode(root: SchemaNode, nodeId: string, newLabel: string): SchemaNode {
  return mapTree(root, (node) => (node.id === nodeId ? { ...node, label: newLabel } : node));
}

export function flattenLeaves(root: SchemaNode): SchemaNode[] {
  if (root.kind === "leaf") return [root];
  return (root.children ?? []).flatMap(flattenLeaves);
}

// A node's own id plus every descendant's — used to prune mapping edges that pointed
// into a subtree the user just deleted from the JSON tree.
export function collectIds(node: SchemaNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

// Ordered chain of nodes from (but excluding) root down to and including targetId.
// The transformation engine walks this to resolve a leaf's real payload value —
// each "array" node in the chain means "index into this before going deeper" —
// without caring whether ids/paths encode arrays with a "[]" suffix or not (XML
// inference and EDI conversion do; JSON schema-as-you-go authoring doesn't).
export function pathFromRoot(root: SchemaNode, targetId: string): SchemaNode[] | null {
  function search(node: SchemaNode, acc: SchemaNode[]): SchemaNode[] | null {
    const nextAcc = [...acc, node];
    if (node.id === targetId) return nextAcc;
    for (const child of node.children ?? []) {
      const found = search(child, nextAcc);
      if (found) return found;
    }
    return null;
  }
  const full = search(root, []);
  return full ? full.slice(1) : null;
}

// Walks a node's ancestor chain (from the tree root) looking for the nearest
// enclosing "array" node — used by the mapping engine to resolve repeating scope.
export function findNearestArrayAncestor(root: SchemaNode, targetId: string): SchemaNode | null {
  const chain = pathFromRoot(root, targetId);
  if (!chain) return null;
  // chain's last entry is the target itself — walk backwards from its parent.
  for (let i = chain.length - 2; i >= 0; i--) {
    if (chain[i].kind === "array") return chain[i];
  }
  return null;
}

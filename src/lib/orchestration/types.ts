// A Process is a linear chain, Start to End, of typed nodes wired by edges — the
// canvas mirrors the mapping tool's MappingCanvas/MappingEdge pattern (same
// @xyflow/react dependency), but here the "mapping" being wired is a sequence of
// integration steps, not field-to-field connections.

export type ProcessNodeType = "start" | "end" | "input" | "tradingPartner" | "map" | "script" | "output";

// FTP credentials sit in the node config (and therefore in the process's saved
// JSONB definition) — there is no encryption-at-rest layer anywhere in this app
// yet, so treat this the same way DATABASE_URL is treated: a real gap, not
// something to pretend is solved. Passwords are masked in the UI (not re-displayed
// once saved) as a minimal mitigation, not a substitute for real secret storage.
export interface FtpLocation {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean; // FTPS (explicit TLS) vs plain FTP
  remoteDir: string;
  filePattern?: string; // input only — a simple glob, e.g. "*.xml"; first match wins
}

export interface FolderLocation {
  path: string;
  filePattern?: string; // input only
}

export type InputSource = { kind: "ftp"; ftp: FtpLocation } | { kind: "folder"; folder: FolderLocation };
export type OutputDestination = { kind: "ftp"; ftp: FtpLocation } | { kind: "folder"; folder: FolderLocation };

export interface MapNodeConfig {
  mapId: string | null; // references a saved map (mapping_documents.id) — run xmlToJsonMappings then jsonToEdiMappings
}

export type ProcessNodeConfig =
  | { type: "start" }
  | { type: "end" }
  | { type: "input"; source: InputSource | null }
  | { type: "tradingPartner" }
  | { type: "map"; map: MapNodeConfig }
  | { type: "script" } // runtime/language intentionally undecided (BRD open question) — always a no-op passthrough
  | { type: "output"; destination: OutputDestination | null };

export interface ProcessNode {
  id: string;
  label: string;
  position: { x: number; y: number };
  config: ProcessNodeConfig;
}

export interface ProcessEdge {
  id: string;
  source: string;
  target: string;
}

export interface ProcessDefinition {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

export const EMPTY_PROCESS_DEFINITION: ProcessDefinition = {
  nodes: [
    { id: "start", label: "Start", position: { x: 40, y: 120 }, config: { type: "start" } },
    { id: "end", label: "End", position: { x: 880, y: 120 }, config: { type: "end" } },
  ],
  edges: [],
};

export function defaultConfigFor(type: ProcessNodeType): ProcessNodeConfig {
  switch (type) {
    case "start":
      return { type: "start" };
    case "end":
      return { type: "end" };
    case "input":
      return { type: "input", source: null };
    case "tradingPartner":
      return { type: "tradingPartner" };
    case "map":
      return { type: "map", map: { mapId: null } };
    case "script":
      return { type: "script" };
    case "output":
      return { type: "output", destination: null };
  }
}

// Shared drag-and-drop MIME key — the palette (drag source) and canvas (drop
// target) live in different components and need to agree on this string.
export const NODE_DRAG_MIME = "application/x-orchestration-node-type";

export const NODE_TYPE_LABEL: Record<ProcessNodeType, string> = {
  start: "Start",
  end: "End",
  input: "Input (FTP/Folder)",
  tradingPartner: "Trading Partner",
  map: "Map",
  script: "Script",
  output: "Output (FTP/Folder)",
};

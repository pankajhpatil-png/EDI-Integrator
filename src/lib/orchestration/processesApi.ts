import type { ProcessSummary } from "@/lib/server/processesDb";
import type { RunResult } from "./runProcess";
import type { ProcessDefinition } from "./types";

export type { ProcessSummary, RunResult };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function listProcesses(): Promise<{ processes: ProcessSummary[] }> {
  return api("/api/processes");
}

export function getProcess(id: string): Promise<{ process: { id: string; name: string; definition: ProcessDefinition } }> {
  return api(`/api/processes/${id}`);
}

export function createProcess(name: string, definition: ProcessDefinition): Promise<{ process: ProcessSummary }> {
  return api("/api/processes", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ name, definition }) });
}

export function updateProcess(id: string, updates: { name?: string; definition?: ProcessDefinition }): Promise<{ process: ProcessSummary }> {
  return api(`/api/processes/${id}`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(updates) });
}

export function deleteProcess(id: string): Promise<{ ok: true }> {
  return api(`/api/processes/${id}`, { method: "DELETE" });
}

export function runProcessRemote(definition: ProcessDefinition): Promise<{ result: RunResult }> {
  return api("/api/processes/run", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ definition }) });
}

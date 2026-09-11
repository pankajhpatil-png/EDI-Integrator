import type { MapSnapshot } from "./mapSnapshot";

// Thin client-side wrappers around /api/maps — shared by MapSessionControls (the
// header Save/Load UI) and MapCompletionPrompt (the inline "name this map" nudge),
// so both hit the same endpoints the same way instead of duplicating fetch/error
// handling.

export interface MapSummary {
  id: string;
  name: string;
  updatedAt: string;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body;
}

export function listSavedMaps(): Promise<{ maps: MapSummary[] }> {
  return api("/api/maps");
}

export function getSavedMap(id: string): Promise<{ map: { id: string; name: string; data: MapSnapshot } }> {
  return api(`/api/maps/${id}`);
}

export function createSavedMap(name: string, data: MapSnapshot): Promise<{ map: MapSummary }> {
  return api("/api/maps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, data }),
  });
}

export function updateSavedMap(id: string, updates: { name?: string; data?: MapSnapshot }): Promise<{ map: MapSummary }> {
  return api(`/api/maps/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export function deleteSavedMap(id: string): Promise<{ ok: true }> {
  return api(`/api/maps/${id}`, { method: "DELETE" });
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/lib/store/AppStateContext";
import { deleteSavedMap, getSavedMap, listSavedMaps, createSavedMap, updateSavedMap, type MapSummary } from "@/lib/store/mapApi";

export default function MapSessionControls() {
  const { currentMapId, currentMapName, getSnapshot, loadSnapshot, markSaved, resetSession } = useAppState();

  const [namingOpen, setNamingOpen] = useState<"save" | "saveAs" | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadOpen, setLoadOpen] = useState(false);
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setLoadOpen(false);
        setNamingOpen(null);
      }
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  async function refreshList() {
    setListError(null);
    try {
      const { maps } = await listSavedMaps();
      setMaps(maps);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to list saved maps.");
    }
  }

  function openLoad() {
    setNamingOpen(null);
    setLoadOpen((prev) => !prev);
    if (!loadOpen) refreshList();
  }

  async function saveUnderName(name: string) {
    setBusy(true);
    setError(null);
    try {
      const { map } = currentMapId
        ? await updateSavedMap(currentMapId, { name, data: getSnapshot() })
        : await createSavedMap(name, getSnapshot());
      markSaved({ id: map.id, name: map.name });
      setNamingOpen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  function handleSaveClick() {
    setError(null);
    if (currentMapName) {
      saveUnderName(currentMapName);
    } else {
      setNameDraft("");
      setNamingOpen("save");
    }
  }

  function handleSaveAsClick() {
    setError(null);
    setNameDraft(currentMapName ?? "");
    setNamingOpen("saveAs");
  }

  async function handleLoad(id: string) {
    if (!window.confirm("Load this map? Any unsaved changes in the current session will be replaced.")) return;
    setBusy(true);
    setError(null);
    try {
      const { map } = await getSavedMap(id);
      loadSnapshot(map.data, { id: map.id, name: map.name });
      setLoadOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load map.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete saved map "${name}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSavedMap(id);
      if (id === currentMapId) resetSession();
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete map.");
    } finally {
      setBusy(false);
    }
  }

  function handleNew() {
    if (!window.confirm("Start a new session? Any unsaved changes will be lost.")) return;
    resetSession();
    setLoadOpen(false);
    setNamingOpen(null);
  }

  return (
    <div ref={panelRef} className="relative flex items-center gap-1.5 text-sm">
      <span className="hidden max-w-[160px] truncate font-medium sm:inline" style={{ color: "var(--ink-muted)" }} title={currentMapName ?? "Unsaved session"}>
        {currentMapName ?? "Unsaved session"}
      </span>

      <button
        type="button"
        onClick={handleSaveClick}
        disabled={busy}
        className="rounded-md border px-2 py-1 text-xs font-semibold"
        style={{ borderColor: "var(--border)", color: "var(--ink)" }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={handleSaveAsClick}
        disabled={busy}
        className="rounded-md border px-2 py-1 text-xs font-medium"
        style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
      >
        Save as…
      </button>
      <button
        type="button"
        onClick={openLoad}
        disabled={busy}
        className="rounded-md border px-2 py-1 text-xs font-medium"
        style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
      >
        Load ▾
      </button>
      <button
        type="button"
        onClick={handleNew}
        disabled={busy}
        className="rounded-md border px-2 py-1 text-xs font-medium"
        style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
      >
        New
      </button>

      {namingOpen && (
        <div
          className="absolute right-0 top-full z-10 mt-2 flex w-64 flex-col gap-2 rounded-lg border p-3 shadow-lg"
          style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            {namingOpen === "saveAs" ? "Save as new map" : "Name this map"}
          </span>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && nameDraft.trim() && saveUnderName(nameDraft.trim())}
            placeholder="e.g. Acme 850 outbound"
            className="rounded-md border px-2 py-1 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!nameDraft.trim() || busy}
              onClick={() => saveUnderName(nameDraft.trim())}
              className="rounded-md px-3 py-1 text-xs font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: !nameDraft.trim() || busy ? 0.6 : 1 }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setNamingOpen(null)}
              className="rounded-md border px-3 py-1 text-xs"
              style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loadOpen && (
        <div
          className="absolute right-0 top-full z-10 mt-2 flex w-80 flex-col gap-2 rounded-lg border p-3 shadow-lg"
          style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            Saved maps
          </span>
          {listError && (
            <div className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}>
              {listError}
            </div>
          )}
          {!maps && !listError && (
            <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
              Loading…
            </span>
          )}
          {maps?.length === 0 && (
            <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
              No saved maps yet.
            </span>
          )}
          {maps && maps.length > 0 && (
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {maps.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs" style={{ background: "var(--surface)" }}>
                  <button type="button" onClick={() => handleLoad(m.id)} className="min-w-0 flex-1 truncate text-left font-medium" style={{ color: "var(--ink)" }}>
                    {m.name}
                    <span className="ml-2 font-normal" style={{ color: "var(--ink-muted)" }}>
                      {new Date(m.updatedAt).toLocaleString()}
                    </span>
                  </button>
                  <button type="button" onClick={() => handleDelete(m.id, m.name)} className="shrink-0 rounded px-1 font-bold" style={{ color: "var(--danger)" }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          className="absolute right-0 top-full z-10 mt-2 w-64 rounded-md border px-2 py-1 text-xs"
          style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

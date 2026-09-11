"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store/AppStateContext";
import { createSavedMap } from "@/lib/store/mapApi";

export interface MapCompletionPromptProps {
  // Whether the mapping looks done (no validation issues, at least one field
  // mapped) — the caller decides what "complete" means since that's stage-specific.
  isComplete: boolean;
}

// A quiet nudge, not a blocking dialog — appears inline once a mapping looks
// finished and unsaved, and disappears for good (this session) once saved or
// dismissed. Reuses the same /api/maps create call as the header's Save button.
export default function MapCompletionPrompt({ isComplete }: MapCompletionPromptProps) {
  const { currentMapName, getSnapshot, markSaved } = useAppState();
  const [dismissed, setDismissed] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isComplete || currentMapName || dismissed) return null;

  async function handleSave() {
    const name = nameDraft.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const { map } = await createSavedMap(name, getSnapshot());
      markSaved({ id: map.id, name: map.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm"
      style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1" style={{ color: "var(--ink)" }}>
          Every required field is mapped — give this map a name to save it.
        </span>
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="e.g. Acme 850 outbound"
          className="min-w-[180px] flex-1 rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!nameDraft.trim() || busy}
          className="shrink-0 rounded-md px-3 py-1 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: !nameDraft.trim() || busy ? 0.6 : 1 }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded px-1 font-bold"
          style={{ color: "var(--ink-muted)" }}
        >
          ×
        </button>
      </div>
      {error && <span style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

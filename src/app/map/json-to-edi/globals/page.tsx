"use client";

import { useState } from "react";
import type { DeclaredType } from "@/lib/rules/types";
import { useAppState } from "@/lib/store/AppStateContext";

const DECLARED_TYPES: DeclaredType[] = ["integer", "real", "string", "datetime"];

export default function GlobalVariablesPage() {
  const { globalVarDecls, setGlobalVarDecls } = useAppState();

  const [newGlobalName, setNewGlobalName] = useState("");
  const [newGlobalType, setNewGlobalType] = useState<DeclaredType>("real");
  const [newGlobalInitial, setNewGlobalInitial] = useState("0");

  function handleAddGlobal() {
    const name = newGlobalName.trim();
    if (!name || globalVarDecls.some((g) => g.name === name)) return;
    setGlobalVarDecls((prev) => [...prev, { name, type: newGlobalType, initialValue: newGlobalInitial }]);
    setNewGlobalName("");
    setNewGlobalInitial("0");
  }

  function handleRemoveGlobal(name: string) {
    setGlobalVarDecls((prev) => prev.filter((g) => g.name !== name));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Global Variables
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Declared once per mapping, persist across the whole run (and across loop iterations) —
          read/write them from an Extended Rule on the{" "}
          <a href="/map/json-to-edi" className="font-semibold" style={{ color: "var(--accent)" }}>
            Mapping
          </a>{" "}
          page by bare name, e.g. <code>GlobalTotal = GlobalTotal + #LinePrice;</code>.
        </p>
      </div>

      {globalVarDecls.length > 0 && (
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--ink-muted)" }}>
                <th className="px-3 py-1 text-left font-medium">Name</th>
                <th className="px-3 py-1 text-left font-medium">Type</th>
                <th className="px-3 py-1 text-left font-medium">Initial value</th>
                <th className="px-3 py-1" />
              </tr>
            </thead>
            <tbody>
              {globalVarDecls.map((g) => (
                <tr key={g.name} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-3 py-1 font-mono" style={{ color: "var(--ink)" }}>
                    {g.name}
                  </td>
                  <td className="px-3 py-1" style={{ color: "var(--ink-muted)" }}>
                    {g.type}
                  </td>
                  <td className="px-3 py-1 font-mono" style={{ color: "var(--ink-muted)" }}>
                    {g.initialValue || "—"}
                  </td>
                  <td className="px-3 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveGlobal(g.name)}
                      className="rounded px-1 font-bold"
                      style={{ color: "var(--danger)" }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {globalVarDecls.length === 0 && (
        <div
          className="rounded-lg border border-dashed p-6 text-center text-sm"
          style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}
        >
          No global variables declared yet.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <input
          value={newGlobalName}
          onChange={(e) => setNewGlobalName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddGlobal()}
          placeholder="name, e.g. GlobalTotal"
          className="rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
        />
        <select
          value={newGlobalType}
          onChange={(e) => setNewGlobalType(e.target.value as DeclaredType)}
          className="rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
        >
          {DECLARED_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={newGlobalInitial}
          onChange={(e) => setNewGlobalInitial(e.target.value)}
          placeholder="initial value"
          className="w-28 rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
        />
        <button
          type="button"
          onClick={handleAddGlobal}
          className="rounded-md px-3 py-1 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

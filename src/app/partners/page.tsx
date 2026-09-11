"use client";

import { useEffect, useState } from "react";
import {
  createPartner,
  deletePartner,
  listPartners,
  updatePartner,
  type PartnerInput,
  type PartnerRole,
  type TradingPartner,
} from "@/lib/partners/partnersApi";

const inputStyle = { borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" };

function emptyForm(role: PartnerRole): PartnerInput {
  return { name: "", role, isaQualifier: "", isaId: "", gsCode: "", usageIndicator: "T", unbId: "" };
}

function PartnerForm({ initial, onSubmit, onCancel, busy }: { initial: PartnerInput; onSubmit: (input: PartnerInput) => void; onCancel?: () => void; busy: boolean }) {
  const [form, setForm] = useState<PartnerInput>(initial);

  function set<K extends keyof PartnerInput>(key: K, value: PartnerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          Name
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className="rounded-md border px-2 py-1 text-sm" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          ISA Qualifier
          <input value={form.isaQualifier ?? ""} onChange={(e) => set("isaQualifier", e.target.value)} placeholder="e.g. ZZ" className="rounded-md border px-2 py-1 text-sm" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          ISA ID
          <input value={form.isaId ?? ""} onChange={(e) => set("isaId", e.target.value)} placeholder="Interchange ID" className="rounded-md border px-2 py-1 text-sm" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          GS Application Code
          <input value={form.gsCode ?? ""} onChange={(e) => set("gsCode", e.target.value)} className="rounded-md border px-2 py-1 text-sm" style={inputStyle} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          Usage indicator (X12)
          <select value={form.usageIndicator ?? "T"} onChange={(e) => set("usageIndicator", e.target.value as "T" | "P")} className="rounded-md border px-2 py-1 text-sm" style={inputStyle}>
            <option value="T">Test</option>
            <option value="P">Production</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          UNB ID (EDIFACT)
          <input value={form.unbId ?? ""} onChange={(e) => set("unbId", e.target.value)} className="rounded-md border px-2 py-1 text-sm" style={inputStyle} />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!form.name.trim() || busy}
          onClick={() => onSubmit(form)}
          className="rounded-md px-3 py-1.5 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: !form.name.trim() || busy ? 0.6 : 1 }}
        >
          Save
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function PartnerTable({ partners, onEdit, onDelete }: { partners: TradingPartner[]; onEdit: (p: TradingPartner) => void; onDelete: (p: TradingPartner) => void }) {
  if (partners.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>
        None yet.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: "var(--ink-muted)" }}>
            <th className="px-3 py-1 text-left font-medium">Name</th>
            <th className="px-3 py-1 text-left font-medium">ISA Qual.</th>
            <th className="px-3 py-1 text-left font-medium">ISA ID</th>
            <th className="px-3 py-1 text-left font-medium">GS Code</th>
            <th className="px-3 py-1 text-left font-medium">Usage</th>
            <th className="px-3 py-1 text-left font-medium">UNB ID</th>
            <th className="px-3 py-1" />
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
              <td className="px-3 py-1.5 font-medium" style={{ color: "var(--ink)" }}>
                {p.name}
              </td>
              <td className="px-3 py-1.5 font-mono" style={{ color: "var(--ink-muted)" }}>
                {p.isaQualifier || "—"}
              </td>
              <td className="px-3 py-1.5 font-mono" style={{ color: "var(--ink-muted)" }}>
                {p.isaId || "—"}
              </td>
              <td className="px-3 py-1.5 font-mono" style={{ color: "var(--ink-muted)" }}>
                {p.gsCode || "—"}
              </td>
              <td className="px-3 py-1.5" style={{ color: "var(--ink-muted)" }}>
                {p.usageIndicator === "P" ? "Production" : p.usageIndicator === "T" ? "Test" : "—"}
              </td>
              <td className="px-3 py-1.5 font-mono" style={{ color: "var(--ink-muted)" }}>
                {p.unbId || "—"}
              </td>
              <td className="px-3 py-1.5 text-right whitespace-nowrap">
                <button type="button" onClick={() => onEdit(p)} className="mr-2 text-xs font-semibold" style={{ color: "var(--accent)" }}>
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(p)} className="text-xs font-semibold" style={{ color: "var(--danger)" }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartnerSection({ role, title }: { role: PartnerRole; title: string }) {
  const [partners, setPartners] = useState<TradingPartner[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const { partners } = await listPartners(role);
      setPartners(partners);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- fetch-on-mount/role-change */
  useEffect(() => {
    refresh();
  }, [role]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function handleCreate(input: PartnerInput) {
    setBusy(true);
    try {
      await createPartner(input);
      setAdding(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(id: string, input: PartnerInput) {
    setBusy(true);
    try {
      await updatePartner(id, input);
      setEditingId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(p: TradingPartner) {
    if (!window.confirm(`Delete "${p.name}"? Any relationships involving it will be removed too.`)) return;
    try {
      await deletePartner(p.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    }
  }

  const editingPartner = partners?.find((p) => p.id === editingId);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          {title} ({partners?.length ?? 0})
        </span>
        <button type="button" onClick={() => setAdding((v) => !v)} className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
          {adding ? "Cancel" : `+ Add ${role}`}
        </button>
      </div>

      {error && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {adding && <PartnerForm initial={emptyForm(role)} busy={busy} onSubmit={handleCreate} onCancel={() => setAdding(false)} />}
      {editingPartner && (
        <PartnerForm
          initial={editingPartner}
          busy={busy}
          onSubmit={(input) => handleUpdate(editingPartner.id, input)}
          onCancel={() => setEditingId(null)}
        />
      )}

      {partners && <PartnerTable partners={partners} onEdit={(p) => setEditingId(p.id)} onDelete={handleDelete} />}
    </div>
  );
}

export default function PartnersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Trading Partners
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Retailers and suppliers, each with their own ISA/GS (X12) and UNB (EDIFACT) envelope
          identifiers — the same identifiers used to send/receive interchanges, and to validate
          them on the{" "}
          <a href="/partners/validate" className="font-semibold" style={{ color: "var(--accent)" }}>
            Validate Envelope
          </a>{" "}
          page. Link a retailer to its suppliers on the{" "}
          <a href="/partners/relationships" className="font-semibold" style={{ color: "var(--accent)" }}>
            Relationships
          </a>{" "}
          page.
        </p>
      </div>

      <PartnerSection role="retailer" title="Retailers" />
      <PartnerSection role="supplier" title="Suppliers" />
    </div>
  );
}

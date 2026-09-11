"use client";

import { useEffect, useState } from "react";
import { listSupportedTransactions } from "@/lib/edi/schemas";
import {
  createRelationship,
  deleteRelationship,
  listPartners,
  listRelationships,
  setDocumentTypes,
  type DocDirection,
  type RelationshipWithPartners,
  type TradingPartner,
} from "@/lib/partners/partnersApi";

const TRANSACTIONS = listSupportedTransactions();

function DocumentTypeEditor({ relationship, onSaved }: { relationship: RelationshipWithPartners; onSaved: () => void }) {
  const initial = new Map<string, Set<DocDirection>>();
  for (const dt of relationship.documentTypes) {
    const key = `${dt.standard}:${dt.transactionCode}`;
    const set = initial.get(key) ?? new Set<DocDirection>();
    set.add(dt.direction);
    initial.set(key, set);
  }

  const [selected, setSelected] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toggle(key: string, direction: DocDirection) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(key) ?? []);
      if (set.has(direction)) set.delete(direction);
      else set.add(direction);
      if (set.size === 0) next.delete(key);
      else next.set(key, set);
      return next;
    });
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const assignments = Array.from(selected.entries()).flatMap(([key, directions]) => {
        const [standard, transactionCode] = key.split(":");
        return Array.from(directions).map((direction) => ({ standard, transactionCode, direction }));
      });
      await setDocumentTypes(relationship.id, assignments);
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save document types.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
        Document types (direction relative to {relationship.retailer.name})
      </span>
      <div className="overflow-hidden rounded-md border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: "var(--ink-muted)" }}>
              <th className="px-2 py-1 text-left font-medium">Transaction</th>
              <th className="px-2 py-1 text-center font-medium">Outbound (Retailer → Supplier)</th>
              <th className="px-2 py-1 text-center font-medium">Inbound (Supplier → Retailer)</th>
            </tr>
          </thead>
          <tbody>
            {TRANSACTIONS.map((t) => {
              const key = `${t.standard}:${t.code}`;
              const set = selected.get(key);
              return (
                <tr key={key} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-2 py-1" style={{ color: "var(--ink)" }}>
                    {t.standard} {t.code} — {t.name}
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" checked={set?.has("outbound") ?? false} onChange={() => toggle(key, "outbound")} />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" checked={set?.has("inbound") ?? false} onChange={() => toggle(key, "inbound")} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="self-start rounded-md px-3 py-1 text-xs font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: busy ? 0.6 : 1 }}
        >
          Save document types
        </button>
        {saved && <span style={{ color: "var(--ink-muted)" }}>Saved.</span>}
      </div>
      {error && <span style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}

export default function RelationshipsPage() {
  const [retailers, setRetailers] = useState<TradingPartner[]>([]);
  const [suppliers, setSuppliers] = useState<TradingPartner[]>([]);
  const [retailerId, setRetailerId] = useState<string>("");
  const [relationships, setRelationships] = useState<RelationshipWithPartners[] | null>(null);
  const [addSupplierId, setAddSupplierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPartners("retailer"), listPartners("supplier")])
      .then(([r, s]) => {
        setRetailers(r.partners);
        setSuppliers(s.partners);
        if (r.partners.length > 0) setRetailerId(r.partners[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load partners."));
  }, []);

  async function refreshRelationships(forRetailerId: string) {
    if (!forRetailerId) {
      setRelationships([]);
      return;
    }
    try {
      const { relationships } = await listRelationships({ retailerId: forRetailerId });
      setRelationships(relationships);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load relationships.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-retailer-change, same pattern as ThemeToggle
    refreshRelationships(retailerId);
  }, [retailerId]);

  async function handleAddSupplier() {
    if (!retailerId || !addSupplierId) return;
    try {
      await createRelationship(retailerId, addSupplierId);
      setAddSupplierId("");
      await refreshRelationships(retailerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to link supplier.");
    }
  }

  async function handleRemove(relationshipId: string) {
    if (!window.confirm("Remove this supplier relationship? Its document-type assignments will be removed too.")) return;
    try {
      await deleteRelationship(relationshipId);
      await refreshRelationships(retailerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove relationship.");
    }
  }

  const linkedSupplierIds = new Set(relationships?.map((r) => r.supplierId));
  const availableSuppliers = suppliers.filter((s) => !linkedSupplierIds.has(s.id));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Retailer ↔ Supplier Relationships
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Pick a retailer, link it to one or more suppliers, then assign which EDI document types
          each relationship exchanges and in which direction. Add retailers/suppliers first on
          the{" "}
          <a href="/partners" className="font-semibold" style={{ color: "var(--accent)" }}>
            Trading Partners
          </a>{" "}
          page.
        </p>
      </div>

      {error && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {retailers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>
          No retailers yet — add one on the Trading Partners page first.
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            Retailer
            <select
              value={retailerId}
              onChange={(e) => setRetailerId(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              {retailers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={addSupplierId}
              onChange={(e) => setAddSupplierId(e.target.value)}
              className="rounded-md border px-2 py-1 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            >
              <option value="">Select a supplier to link…</option>
              {availableSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddSupplier}
              disabled={!addSupplierId}
              className="rounded-md px-3 py-1.5 text-sm font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: !addSupplierId ? 0.6 : 1 }}
            >
              Link supplier
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {relationships?.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--ink-muted)" }}>
                No suppliers linked to this retailer yet.
              </div>
            )}
            {relationships?.map((rel) => (
              <div key={rel.id} className="flex flex-col gap-2 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === rel.id ? null : rel.id)}
                    className="text-left text-sm font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {expandedId === rel.id ? "▾" : "▸"} {rel.supplier.name}
                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--ink-muted)" }}>
                      {rel.documentTypes.length} document type{rel.documentTypes.length === 1 ? "" : "s"} assigned
                    </span>
                  </button>
                  <button type="button" onClick={() => handleRemove(rel.id)} className="text-xs font-semibold" style={{ color: "var(--danger)" }}>
                    Remove
                  </button>
                </div>
                {expandedId === rel.id && <DocumentTypeEditor relationship={rel} onSaved={() => refreshRelationships(retailerId)} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { listSupportedTransactions } from "@/lib/edi/schemas";
import { validateEnvelope, type EnvelopeMatch } from "@/lib/partners/partnersApi";

const TRANSACTIONS = listSupportedTransactions();
const inputStyle = { borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" };

export default function ValidateEnvelopePage() {
  const [senderIsaId, setSenderIsaId] = useState("");
  const [receiverIsaId, setReceiverIsaId] = useState("");
  const [transactionKey, setTransactionKey] = useState("");
  const [result, setResult] = useState<EnvelopeMatch | null | "unchecked">("unchecked");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleValidate() {
    if (!senderIsaId.trim() || !receiverIsaId.trim()) {
      setError("Enter both a sender and receiver ISA ID.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [standard, transactionCode] = transactionKey ? transactionKey.split(":") : [undefined, undefined];
      const { match } = await validateEnvelope({ senderIsaId: senderIsaId.trim(), receiverIsaId: receiverIsaId.trim(), standard, transactionCode });
      setResult(match);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to validate.");
      setResult("unchecked");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Validate Envelope
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Paste the ISA sender/receiver interchange IDs off a real or sample envelope to check
          them against configured{" "}
          <a href="/partners" className="font-semibold" style={{ color: "var(--accent)" }}>
            trading partners
          </a>{" "}
          and{" "}
          <a href="/partners/relationships" className="font-semibold" style={{ color: "var(--accent)" }}>
            relationships
          </a>
          . Optionally pick a transaction to also check whether that relationship allows it.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            Sender ISA ID (ISA06)
            <input value={senderIsaId} onChange={(e) => setSenderIsaId(e.target.value)} className="rounded-md border px-2 py-1 text-sm font-mono" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            Receiver ISA ID (ISA08)
            <input value={receiverIsaId} onChange={(e) => setReceiverIsaId(e.target.value)} className="rounded-md border px-2 py-1 text-sm font-mono" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs md:col-span-2" style={{ color: "var(--ink-muted)" }}>
            Transaction (optional)
            <select value={transactionKey} onChange={(e) => setTransactionKey(e.target.value)} className="rounded-md border px-2 py-1 text-sm" style={inputStyle}>
              <option value="">— not checking a specific document type —</option>
              {TRANSACTIONS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.standard} {t.code} — {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={handleValidate}
          disabled={busy}
          className="self-start rounded-md px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Checking…" : "Validate"}
        </button>

        {error && (
          <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {result !== "unchecked" &&
          (result === null ? (
            <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}>
              ⛔ No trading partner relationship matches this sender/receiver pair.
            </div>
          ) : (
            <div className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}>
              <span style={{ color: "var(--ink)" }}>
                ✓ Matched: <strong>{result.relationship.retailer.name}</strong> ↔ <strong>{result.relationship.supplier.name}</strong>
              </span>
              <span style={{ color: "var(--ink-muted)" }}>
                Sender is the {result.senderRole}.
              </span>
              {result.documentTypeAllowed !== null && (
                <span style={{ color: result.documentTypeAllowed ? "var(--ink)" : "var(--warning)" }}>
                  {result.documentTypeAllowed ? "✓ Document type is allowed for this relationship." : "⚠ Document type is NOT assigned to this relationship."}
                </span>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

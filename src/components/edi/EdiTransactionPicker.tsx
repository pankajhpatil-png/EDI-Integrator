"use client";

import { useSelectedEdiSchema } from "@/lib/mapping/useSelectedEdiSchema";

export default function EdiTransactionPicker() {
  const { transactions, selectedKey, setSelectedEdiTransactionKey } = useSelectedEdiSchema();

  return (
    <select
      value={selectedKey}
      onChange={(e) => setSelectedEdiTransactionKey(e.target.value)}
      className="w-fit rounded-md border px-3 py-2 text-sm"
      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
    >
      {transactions.map((t) => (
        <option key={t.key} value={t.key}>
          {t.standard} {t.code} — {t.name}
        </option>
      ))}
    </select>
  );
}

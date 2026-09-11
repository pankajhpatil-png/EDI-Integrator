"use client";

import { useState } from "react";

interface HeaderRow {
  key: string;
  value: string;
}

export interface ApiFetchPanelProps {
  onFetched: (text: string) => void;
  // "json" (default) parses the response and applies responsePath. "xml" — or any
  // other raw format — skips parsing entirely and hands back the response body
  // as-is; the responsePath field is hidden since it only makes sense for JSON.
  format?: "json" | "xml";
}

function extractPath(value: unknown, path: string): unknown {
  if (!path.trim()) return value;
  let current = value;
  for (const segment of path.split(".").map((s) => s.trim()).filter(Boolean)) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export default function ApiFetchPanel({ onFetched, format = "json" }: ApiFetchPanelProps) {
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [url, setUrl] = useState("");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([{ key: "", value: "" }]);
  const [body, setBody] = useState("");
  const [responsePath, setResponsePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateHeaderRow(i: number, field: "key" | "value", value: string) {
    setHeaderRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addHeaderRow() {
    setHeaderRows((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeHeaderRow(i: number) {
    setHeaderRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleFetch() {
    if (!url.trim()) {
      setError("Enter a URL first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      for (const row of headerRows) if (row.key.trim()) headers[row.key.trim()] = row.value;

      const res = await fetch("/api/fetch-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, url: url.trim(), headers, body: method === "POST" ? body : undefined }),
      });
      const data: { ok: boolean; status?: number; text?: string; error?: string } = await res.json();

      if (!data.ok) {
        setError(data.status ? `HTTP ${data.status}: ${(data.text ?? "").slice(0, 200)}` : (data.error ?? "Fetch failed."));
        return;
      }

      if (format !== "json") {
        if (!data.text) {
          setError("Response was empty.");
          return;
        }
        onFetched(data.text);
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(data.text ?? "");
      } catch {
        setError("Response was not valid JSON.");
        return;
      }

      const extracted = extractPath(parsed, responsePath);
      if (extracted === undefined) {
        setError(responsePath ? `Path "${responsePath}" not found in the response.` : "Response was empty.");
        return;
      }

      onFetched(JSON.stringify(extracted, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
    >
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
        Fetch from API
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as "GET" | "POST")}
          className="rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/orders/1001"
          className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium" style={{ color: "var(--ink-muted)" }}>
          Headers
        </span>
        {headerRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={row.key}
              onChange={(e) => updateHeaderRow(i, "key", e.target.value)}
              placeholder="Authorization"
              className="w-40 rounded-md border px-2 py-1 text-xs"
              style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
            />
            <input
              value={row.value}
              onChange={(e) => updateHeaderRow(i, "value", e.target.value)}
              placeholder="Bearer ..."
              className="flex-1 rounded-md border px-2 py-1 text-xs"
              style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
            />
            <button type="button" onClick={() => removeHeaderRow(i)} className="rounded px-1 font-bold" style={{ color: "var(--danger)" }}>
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={addHeaderRow} className="self-start text-xs font-semibold" style={{ color: "var(--accent)" }}>
          + header
        </button>
      </div>

      {method === "POST" && (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Request body (JSON)"
          spellCheck={false}
          className="h-20 rounded-md border p-2 font-mono text-xs"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
        />
      )}

      {format === "json" && (
        <input
          value={responsePath}
          onChange={(e) => setResponsePath(e.target.value)}
          placeholder="Optional response path, e.g. data.order"
          className="rounded-md border px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" }}
        />
      )}

      <button
        type="button"
        onClick={handleFetch}
        disabled={loading}
        className="self-start rounded-md px-3 py-1.5 text-sm font-semibold"
        style={{ background: "var(--accent)", color: "var(--accent-ink)", opacity: loading ? 0.6 : 1 }}
      >
        {loading ? "Fetching…" : "Fetch"}
      </button>

      {error && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

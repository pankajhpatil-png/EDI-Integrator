"use client";

import { useEffect, useState } from "react";
import { listSavedMaps, type MapSummary } from "@/lib/store/mapApi";
import type { FolderLocation, FtpLocation, ProcessNode, ProcessNodeConfig } from "@/lib/orchestration/types";

const inputStyle = { borderColor: "var(--border)", background: "var(--bg)", color: "var(--ink)" };

function emptyFtp(): FtpLocation {
  return { host: "", port: 21, user: "", password: "", secure: false, remoteDir: "", filePattern: "*" };
}
function emptyFolder(): FolderLocation {
  return { path: "", filePattern: "*" };
}

function FtpFields({ value, onChange, showPattern }: { value: FtpLocation; onChange: (v: FtpLocation) => void; showPattern: boolean }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
        Host
        <input value={value.host} onChange={(e) => onChange({ ...value, host: e.target.value })} className="rounded-md border px-2 py-1 text-sm" style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
        Port
        <input
          type="number"
          value={value.port}
          onChange={(e) => onChange({ ...value, port: Number(e.target.value) || 21 })}
          className="rounded-md border px-2 py-1 text-sm"
          style={inputStyle}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
        Username
        <input value={value.user} onChange={(e) => onChange({ ...value, user: e.target.value })} className="rounded-md border px-2 py-1 text-sm" style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
        Password
        <input
          type="password"
          value={value.password}
          onChange={(e) => onChange({ ...value, password: e.target.value })}
          className="rounded-md border px-2 py-1 text-sm"
          style={inputStyle}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
        Remote directory
        <input value={value.remoteDir} onChange={(e) => onChange({ ...value, remoteDir: e.target.value })} placeholder="/" className="rounded-md border px-2 py-1 text-sm" style={inputStyle} />
      </label>
      {showPattern && (
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          File pattern
          <input
            value={value.filePattern ?? ""}
            onChange={(e) => onChange({ ...value, filePattern: e.target.value })}
            placeholder="*.xml"
            className="rounded-md border px-2 py-1 text-sm"
            style={inputStyle}
          />
        </label>
      )}
      <label className="flex items-center gap-2 text-xs md:col-span-2" style={{ color: "var(--ink-muted)" }}>
        <input type="checkbox" checked={value.secure} onChange={(e) => onChange({ ...value, secure: e.target.checked })} />
        Use FTPS (explicit TLS)
      </label>
    </div>
  );
}

function FolderFields({ value, onChange, showPattern }: { value: FolderLocation; onChange: (v: FolderLocation) => void; showPattern: boolean }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs md:col-span-2" style={{ color: "var(--ink-muted)" }}>
        Folder path
        <input value={value.path} onChange={(e) => onChange({ ...value, path: e.target.value })} placeholder="C:\path\to\folder" className="rounded-md border px-2 py-1 text-sm font-mono" style={inputStyle} />
      </label>
      {showPattern && (
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          File pattern
          <input
            value={value.filePattern ?? ""}
            onChange={(e) => onChange({ ...value, filePattern: e.target.value })}
            placeholder="*.xml"
            className="rounded-md border px-2 py-1 text-sm"
            style={inputStyle}
          />
        </label>
      )}
    </div>
  );
}

export interface NodeConfigPanelProps {
  node: ProcessNode | null;
  onChange: (config: ProcessNodeConfig) => void;
  onRename: (label: string) => void;
  onRemove: () => void;
}

export default function NodeConfigPanel({ node, onChange, onRename, onRemove }: NodeConfigPanelProps) {
  const [maps, setMaps] = useState<MapSummary[] | null>(null);

  useEffect(() => {
    if (node?.config.type === "map" && !maps) {
      listSavedMaps()
        .then(({ maps }) => setMaps(maps))
        .catch(() => setMaps([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch saved-maps list only once, when a Map node is first selected
  }, [node?.config.type]);

  if (!node) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-raised)", color: "var(--ink-muted)" }}>
        <span className="text-xs font-semibold uppercase tracking-wide">Node configuration</span>
        Click a node on the canvas to configure it.
      </div>
    );
  }

  const config = node.config;
  const canRename = config.type !== "start" && config.type !== "end";
  const canRemove = config.type !== "start" && config.type !== "end";

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3" style={{ borderColor: "var(--accent)", background: "var(--surface-raised)" }}>
      <div className="flex items-center justify-between">
        {canRename ? (
          <input
            value={node.label}
            onChange={(e) => onRename(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm font-semibold"
            style={inputStyle}
          />
        ) : (
          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {node.label}
          </span>
        )}
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-xs font-semibold" style={{ color: "var(--danger)" }}>
            Remove node
          </button>
        )}
      </div>

      {(config.type === "start" || config.type === "end") && (
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          No configuration needed.
        </p>
      )}

      {config.type === "tradingPartner" && (
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          No configuration needed — resolves automatically from the fetched file&rsquo;s ISA/UNB envelope against{" "}
          <a href="/partners/relationships" className="font-semibold" style={{ color: "var(--accent)" }}>
            configured relationships
          </a>
          . Fails the run if no match is found.
        </p>
      )}

      {config.type === "script" && (
        <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
          Script runtime/language is not yet decided (open question). This node is currently a no-op
          passthrough when the process runs.
        </p>
      )}

      {config.type === "map" && (
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          Saved map
          <select
            value={config.map.mapId ?? ""}
            onChange={(e) => onChange({ type: "map", map: { mapId: e.target.value || null } })}
            className="rounded-md border px-2 py-1 text-sm"
            style={inputStyle}
          >
            <option value="">— select a saved map —</option>
            {maps?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {maps?.length === 0 && <span style={{ color: "var(--warning)" }}>No saved maps yet — build and save one on the Mapping page first.</span>}
        </label>
      )}

      {config.type === "input" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => onChange({ type: "input", source: { kind: "ftp", ftp: config.source?.kind === "ftp" ? config.source.ftp : emptyFtp() } })}
              className="rounded-md border px-2 py-1 font-semibold"
              style={{ borderColor: config.source?.kind === "ftp" ? "var(--accent)" : "var(--border)", color: config.source?.kind === "ftp" ? "var(--accent)" : "var(--ink-muted)" }}
            >
              FTP
            </button>
            <button
              type="button"
              onClick={() => onChange({ type: "input", source: { kind: "folder", folder: config.source?.kind === "folder" ? config.source.folder : emptyFolder() } })}
              className="rounded-md border px-2 py-1 font-semibold"
              style={{ borderColor: config.source?.kind === "folder" ? "var(--accent)" : "var(--border)", color: config.source?.kind === "folder" ? "var(--accent)" : "var(--ink-muted)" }}
            >
              Folder
            </button>
          </div>
          {config.source?.kind === "ftp" && (
            <FtpFields showPattern value={config.source.ftp} onChange={(ftp) => onChange({ type: "input", source: { kind: "ftp", ftp } })} />
          )}
          {config.source?.kind === "folder" && (
            <FolderFields showPattern value={config.source.folder} onChange={(folder) => onChange({ type: "input", source: { kind: "folder", folder } })} />
          )}
        </div>
      )}

      {config.type === "output" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => onChange({ type: "output", destination: { kind: "ftp", ftp: config.destination?.kind === "ftp" ? config.destination.ftp : emptyFtp() } })}
              className="rounded-md border px-2 py-1 font-semibold"
              style={{ borderColor: config.destination?.kind === "ftp" ? "var(--accent)" : "var(--border)", color: config.destination?.kind === "ftp" ? "var(--accent)" : "var(--ink-muted)" }}
            >
              FTP
            </button>
            <button
              type="button"
              onClick={() => onChange({ type: "output", destination: { kind: "folder", folder: config.destination?.kind === "folder" ? config.destination.folder : emptyFolder() } })}
              className="rounded-md border px-2 py-1 font-semibold"
              style={{ borderColor: config.destination?.kind === "folder" ? "var(--accent)" : "var(--border)", color: config.destination?.kind === "folder" ? "var(--accent)" : "var(--ink-muted)" }}
            >
              Folder
            </button>
          </div>
          {config.destination?.kind === "ftp" && (
            <FtpFields value={config.destination.ftp} showPattern={false} onChange={(ftp) => onChange({ type: "output", destination: { kind: "ftp", ftp } })} />
          )}
          {config.destination?.kind === "folder" && (
            <FolderFields value={config.destination.folder} showPattern={false} onChange={(folder) => onChange({ type: "output", destination: { kind: "folder", folder } })} />
          )}
        </div>
      )}
    </div>
  );
}

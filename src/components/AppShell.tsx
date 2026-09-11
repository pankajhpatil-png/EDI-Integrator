import type { ReactNode } from "react";
import NavSidebar from "./NavSidebar";
import ThemeToggle from "./ThemeToggle";
import MapSessionControls from "./maps/MapSessionControls";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="flex items-center justify-between gap-2 border-b px-4 py-4 md:px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-col">
          <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>
            XML → JSON → EDI Mapping Tool
          </span>
          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Universal Schema-Agnostic Mapping Workbench
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapSessionControls />
          <ThemeToggle />
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              PP
            </span>
            <span className="text-sm font-medium hidden sm:inline" style={{ color: "var(--ink)" }}>
              Pankaj
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col md:flex-row">
        <aside
          className="w-full shrink-0 border-b md:w-[200px] md:border-b-0 md:border-r"
          style={{ borderColor: "var(--border)" }}
        >
          <NavSidebar />
        </aside>
        <main className="flex flex-1 flex-col px-4 py-6 md:px-8 md:py-8 min-w-0">
          <div className="flex-1 min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}

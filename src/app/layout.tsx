import type { Metadata } from "next";
import Script from "next/script";
import AppShell from "@/components/AppShell";
import { AppStateProvider } from "@/lib/store/AppStateContext";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "XML → JSON → EDI Mapping Tool",
  description: "Visually map arbitrary XML to JSON, then JSON to X12/EDIFACT EDI.",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("xmlJsonEdiMappingToolTheme");
    var theme = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: the beforeInteractive script below sets
  // data-theme on this element before React hydrates, based on
  // localStorage/prefers-color-scheme the server can't know about —
  // that's an intentional, expected mismatch, not a bug.
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <AppStateProvider>
          <AppShell>{children}</AppShell>
        </AppStateProvider>
      </body>
    </html>
  );
}

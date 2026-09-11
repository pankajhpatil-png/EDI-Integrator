"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const JSON_TO_EDI_ITEMS = [
  { href: "/map/json-to-edi", label: "Mapping" },
  { href: "/map/json-to-edi/globals", label: "Global Variables" },
  { href: "/map/json-to-edi/reference", label: "EDI Reference" },
];

const PARTNER_ITEMS = [
  { href: "/partners", label: "Partners" },
  { href: "/partners/relationships", label: "Relationships" },
  { href: "/partners/validate", label: "Validate Envelope" },
];

function NavLink({ href, label, exact = false }: { href: string; label: string; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm font-medium transition-colors"
      style={{
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--ink-muted)",
      }}
    >
      {label}
    </Link>
  );
}

export default function NavSidebar() {
  return (
    <nav className="flex flex-col gap-1 p-3">
      <NavLink href="/" label="Overview" exact />
      <NavLink href="/orchestration" label="Orchestration" />
      <NavLink href="/map/xml-to-json" label="XML → JSON" />

      <span
        className="mt-2 px-3 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--ink-muted)" }}
      >
        JSON → EDI
      </span>
      <div className="flex flex-col gap-1 border-l pl-2" style={{ borderColor: "var(--border)" }}>
        {JSON_TO_EDI_ITEMS.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} exact />
        ))}
      </div>

      <span
        className="mt-2 px-3 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--ink-muted)" }}
      >
        Trading Partners
      </span>
      <div className="flex flex-col gap-1 border-l pl-2" style={{ borderColor: "var(--border)" }}>
        {PARTNER_ITEMS.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} exact />
        ))}
      </div>
    </nav>
  );
}

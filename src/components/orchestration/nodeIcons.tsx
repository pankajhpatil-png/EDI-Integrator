import type { ReactNode } from "react";
import type { ProcessNodeType } from "@/lib/orchestration/types";

// Small hand-drawn icons (no icon-library dependency) — one per node type, drawn in
// a shared 20x20 viewBox so they align consistently inside the node badge.
const ICON_PATHS: Record<ProcessNodeType, ReactNode> = {
  start: <path d="M6 4l10 6-10 6V4z" fill="currentColor" />,
  end: <rect x="5" y="5" width="10" height="10" rx="1.5" fill="currentColor" />,
  input: (
    <>
      <path d="M10 3v9M6.5 9 10 12.5 13.5 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13.5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  output: (
    <>
      <path d="M10 12.5v-9M6.5 6.5 10 3l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13.5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  tradingPartner: (
    <>
      <circle cx="7" cy="10" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="13" cy="10" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  map: (
    <>
      <path d="M4 7h11M12 4l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 13H5M8 10l-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  script: <path d="M7 5 3 10l4 5M13 5l4 5-4 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
};

export interface NodeIconProps {
  type: ProcessNodeType;
  size?: number;
}

export default function NodeIcon({ type, size = 16 }: NodeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {ICON_PATHS[type]}
    </svg>
  );
}

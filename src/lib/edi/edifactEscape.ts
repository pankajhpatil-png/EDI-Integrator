import type { EdifactDelimiters } from "./delimiterTypes";

// Inverse of AI_EDI_Inspector's splitRespectingRelease (edifact/segments.ts): that
// function treats `release` as an escape character for whatever follows it, so
// writing valid EDIFACT means inserting `release` before any reserved character
// that appears literally inside a data value (ISO 9735 §7).
export function escapeEdifactValue(value: string, delims: EdifactDelimiters): string {
  const reserved = [delims.release, delims.component, delims.element, delims.decimal, delims.terminator].filter(
    (c) => c.length > 0
  );
  let result = "";
  for (const ch of value) {
    if (reserved.includes(ch)) result += delims.release;
    result += ch;
  }
  return result;
}

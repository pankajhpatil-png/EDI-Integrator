import type { EdiSegmentSchema } from "./schemaTypes";
import type { X12Delimiters, EdifactDelimiters } from "./delimiterTypes";
import { escapeEdifactValue } from "./edifactEscape";

export type EdiStandard = "X12" | "EDIFACT";
export type EdiDelimiters = X12Delimiters | EdifactDelimiters;

// Builds one segment string from its schema + a map of elementId -> value.
// Fills gaps between defined element positions with empty slots (so a value at
// position 5 doesn't silently shift left when position 4 has no schema entry),
// then trims only TRAILING, OPTIONAL, empty slots — never a required or
// non-trailing one — so e.g. "BEG*00*NE*4500123**20260101~" (BEG04 genuinely
// blank, BEG05 present) is preserved correctly while a fully-unused trailing
// optional element is dropped instead of leaving a dangling delimiter.
export function buildSegment(
  schema: EdiSegmentSchema,
  values: Record<string, string>,
  delims: EdiDelimiters,
  standard: EdiStandard
): string {
  const maxPosition = Math.max(0, ...schema.elements.map((e) => e.position));
  const slots: string[] = new Array(maxPosition).fill("");
  const requiredSlots: boolean[] = new Array(maxPosition).fill(false);

  for (const el of schema.elements) {
    let value = values[el.id] ?? el.fixedValue ?? "";
    if (standard === "EDIFACT" && value) value = escapeEdifactValue(value, delims as EdifactDelimiters);
    slots[el.position - 1] = value;
    requiredSlots[el.position - 1] = el.required;
  }

  let end = slots.length;
  while (end > 0 && slots[end - 1] === "" && !requiredSlots[end - 1]) end--;
  const trimmed = slots.slice(0, end);

  const elementSep = delims.element;
  const terminator = delims.terminator;
  return schema.tag + elementSep + trimmed.join(elementSep) + terminator;
}

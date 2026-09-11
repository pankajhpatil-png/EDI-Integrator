import type { EdiElementSchema, EdiSegmentSchema, EdiTransactionSchema } from "@/lib/edi/schemaTypes";

// Single source of truth for "which EDI element does this canvas target node id refer
// to, and is it inside the repeating body loop" — used by both the transformation
// engine (generateEdiPreview) and the validation engine (validateMapping) so the two
// never drift on how a target node id maps back to its schema element.
export interface EdiElementIndexEntry {
  element: EdiElementSchema;
  segment: EdiSegmentSchema;
  targetNodeId: string;
  isLoop: boolean;
}

// An EDI leaf's own id is built as `${parentPath}.${el.id}` (see toSchemaNode.ts), so
// its final path segment is always exactly the schema element id (e.g. "PO101").
export function elementIdFromTargetNodeId(targetNodeId: string): string {
  return targetNodeId.slice(targetNodeId.lastIndexOf(".") + 1);
}

export function buildEdiElementIndex(schema: EdiTransactionSchema): Map<string, EdiElementIndexEntry> {
  const index = new Map<string, EdiElementIndexEntry>();

  function addSegments(segments: EdiSegmentSchema[], sectionPrefix: string, isLoop: boolean) {
    for (const segment of segments) {
      for (const element of segment.elements) {
        index.set(element.id, { element, segment, targetNodeId: `${sectionPrefix}.${segment.tag}.${element.id}`, isLoop });
      }
    }
  }

  addSegments(schema.header, "root.header", false);
  addSegments(schema.bodyLoop.segments, `root.${schema.bodyLoop.id}[]`, true);
  addSegments(schema.trailer, "root.trailer", false);

  return index;
}

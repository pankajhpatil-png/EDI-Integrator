// Declarative EDI schema format — hand-authored per transaction type. This is the
// data that lets the writer/envelope builder GENERATE valid output, which no
// existing code in this codebase provides (the sibling apps only validate EDI
// that already exists). See envelope.ts for why derivedValue matters.

export type EdiDataType = "AN" | "N0" | "N2" | "DT" | "TM" | "ID";

export interface EdiElementSchema {
  id: string; // e.g. "BEG02" — matches the mapping-graph's ediRef.elementPosition target
  name: string;
  position: number; // 1-based within the segment
  dataType: EdiDataType;
  maxLength?: number;
  required: boolean;
  fixedValue?: string; // hard-filled qualifier, e.g. N101 = "BY"
  // Filled automatically by envelope.ts — never mapped by the user on the canvas,
  // and excluded from the tree the canvas ever sees (see toSchemaNode.ts).
  derivedValue?: "loopInstanceCount" | "segmentCount" | "controlNumber";
}

export interface EdiSegmentSchema {
  tag: string; // "BEG", "N1", "PO1"
  name: string;
  required: boolean;
  elements: EdiElementSchema[];
}

export interface EdiLoopSchema {
  id: string; // "PO1Loop"
  repeating: true; // V1 only models one repeating body loop per transaction
  segments: EdiSegmentSchema[];
}

export interface EdiTransactionSchema {
  standard: "X12" | "EDIFACT";
  transactionCode: string; // "850" | "ORDERS"
  name: string;
  header: EdiSegmentSchema[]; // everything before the loop (ST/BEG/N1... or UNH/BGM/NAD...)
  bodyLoop: EdiLoopSchema; // the single supported repeating loop
  trailer: EdiSegmentSchema[]; // CTT/SE, or UNS/UNT
}

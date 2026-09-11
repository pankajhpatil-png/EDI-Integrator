// Extracts sender/receiver interchange identifiers from a real EDI file's envelope
// segment — the Trading Partner node's whole job is resolving these against
// findRelationshipByEnvelope. Delimiter-driven parsing (split on the character that
// follows the segment tag) rather than the classic fixed-width ISA layout: simpler,
// and robust enough for a design/test tool rather than a certified EDI validator.

export interface EnvelopeIds {
  senderId: string;
  receiverId: string;
}

// ISA*00*          *00*          *ZZ*SENDERID       *ZZ*RECEIVERID     *...~
// Elements (0-indexed after split, [0] is the literal "ISA" tag): [6]=ISA06 sender,
// [8]=ISA08 receiver.
export function parseX12Envelope(text: string): EnvelopeIds | null {
  const isaIndex = text.indexOf("ISA");
  if (isaIndex === -1) return null;
  const elementSep = text[isaIndex + 3];
  if (!elementSep) return null;

  const segment = text.slice(isaIndex, isaIndex + 200);
  const elements = segment.split(elementSep);
  if (elements.length < 9) return null;

  const senderId = elements[6]?.trim();
  const receiverId = elements[8]?.trim();
  if (!senderId || !receiverId) return null;
  return { senderId, receiverId };
}

// UNB+UNOA:2+SENDERID:ZZ+RECEIVERID:ZZ+260908:1200+1++++1'
// Elements (0-indexed, [0] is "UNB"): [2]=sender (id:qualifier), [3]=receiver.
export function parseEdifactEnvelope(text: string): EnvelopeIds | null {
  const unbIndex = text.indexOf("UNB");
  if (unbIndex === -1) return null;
  const elementSep = text[unbIndex + 3];
  if (!elementSep) return null;

  const rawSegment = text.slice(unbIndex, unbIndex + 200);
  const terminatorIndex = rawSegment.indexOf("'");
  const segment = terminatorIndex === -1 ? rawSegment : rawSegment.slice(0, terminatorIndex);
  const elements = segment.split(elementSep);
  if (elements.length < 4) return null;

  const senderId = elements[2]?.split(":")[0]?.trim();
  const receiverId = elements[3]?.split(":")[0]?.trim();
  if (!senderId || !receiverId) return null;
  return { senderId, receiverId };
}

// Tries X12 first (ISA appears earlier in the string than UNB would in a
// same-named-but-different-standard edge case is not a real concern — a file is
// one standard or the other), falls back to EDIFACT.
export function parseEnvelope(text: string): { standard: "X12" | "EDIFACT"; ids: EnvelopeIds } | null {
  const x12 = parseX12Envelope(text);
  if (x12) return { standard: "X12", ids: x12 };
  const edifact = parseEdifactEnvelope(text);
  if (edifact) return { standard: "EDIFACT", ids: edifact };
  return null;
}

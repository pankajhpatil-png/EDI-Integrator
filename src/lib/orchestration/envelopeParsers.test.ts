import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEdifactEnvelope, parseEnvelope, parseX12Envelope } from "./envelopeParsers";

const X12_SAMPLE =
  "ISA*00*          *00*          *ZZ*ACMERETAIL     *ZZ*WIDGETCO       *260908*1200*U*00401*000000001*0*T*>~" +
  "GS*PO*ACMERETAIL*WIDGETCO*20260908*1200*1*X*004010~";

const EDIFACT_SAMPLE = "UNB+UNOA:2+ACMERETAIL:ZZ+WIDGETCO:ZZ+260908:1200+1++++1'UNH+1+ORDERS:D:96A:UN'";

test("parseX12Envelope: extracts ISA06/ISA08 sender/receiver", () => {
  assert.deepEqual(parseX12Envelope(X12_SAMPLE), { senderId: "ACMERETAIL", receiverId: "WIDGETCO" });
});

test("parseX12Envelope: returns null when no ISA segment is present", () => {
  assert.equal(parseX12Envelope("not an edi file"), null);
});

test("parseEdifactEnvelope: extracts UNB sender/recipient, dropping the qualifier", () => {
  assert.deepEqual(parseEdifactEnvelope(EDIFACT_SAMPLE), { senderId: "ACMERETAIL", receiverId: "WIDGETCO" });
});

test("parseEdifactEnvelope: returns null when no UNB segment is present", () => {
  assert.equal(parseEdifactEnvelope("not an edi file"), null);
});

test("parseEnvelope: detects X12 vs EDIFACT and tags the standard", () => {
  assert.deepEqual(parseEnvelope(X12_SAMPLE), { standard: "X12", ids: { senderId: "ACMERETAIL", receiverId: "WIDGETCO" } });
  assert.deepEqual(parseEnvelope(EDIFACT_SAMPLE), { standard: "EDIFACT", ids: { senderId: "ACMERETAIL", receiverId: "WIDGETCO" } });
});

test("parseEnvelope: returns null for content with neither envelope", () => {
  assert.equal(parseEnvelope("<Order><Header/></Order>"), null);
});

import type { EdiTransactionSchema } from "../schemaTypes";
import { X12_850 } from "./x12/850";
import { X12_810 } from "./x12/810";
import { X12_856 } from "./x12/856";
import { EDIFACT_ORDERS } from "./edifact/orders";
import { EDIFACT_INVOIC } from "./edifact/invoic";
import { EDIFACT_DESADV } from "./edifact/desadv";

// Key format: "<standard>:<transactionCode>", e.g. "X12:850", "EDIFACT:ORDERS".
export const EDI_SCHEMAS: Record<string, EdiTransactionSchema> = {
  "X12:850": X12_850,
  "X12:810": X12_810,
  "X12:856": X12_856,
  "EDIFACT:ORDERS": EDIFACT_ORDERS,
  "EDIFACT:INVOIC": EDIFACT_INVOIC,
  "EDIFACT:DESADV": EDIFACT_DESADV,
};

export function listSupportedTransactions(): { key: string; standard: string; code: string; name: string }[] {
  return Object.entries(EDI_SCHEMAS).map(([key, schema]) => ({
    key,
    standard: schema.standard,
    code: schema.transactionCode,
    name: schema.name,
  }));
}

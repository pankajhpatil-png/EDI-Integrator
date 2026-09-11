"use client";

import { useMemo } from "react";
import { EDI_SCHEMAS, listSupportedTransactions } from "@/lib/edi/schemas";
import { ediTransactionToSchemaNode } from "@/lib/edi/toSchemaNode";
import { useAppState } from "@/lib/store/AppStateContext";

// Shared across every JSON -> EDI page (Mapping, Reference, Test & Preview) so
// picking a transaction on one page is reflected on the others — there is one
// target transaction per mapping session, not one per page.
export function useSelectedEdiSchema() {
  const { selectedEdiTransactionKey, setSelectedEdiTransactionKey } = useAppState();
  const transactions = useMemo(() => listSupportedTransactions(), []);
  const selectedKey = selectedEdiTransactionKey ?? transactions[0]?.key ?? "";
  const schema = EDI_SCHEMAS[selectedKey];
  const targetRoot = useMemo(() => (schema ? ediTransactionToSchemaNode(schema) : null), [schema]);

  return { transactions, selectedKey, setSelectedEdiTransactionKey, schema, targetRoot };
}

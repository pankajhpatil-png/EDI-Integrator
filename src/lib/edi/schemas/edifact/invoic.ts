import type { EdiTransactionSchema } from "../../schemaTypes";

export const EDIFACT_INVOIC: EdiTransactionSchema = {
  standard: "EDIFACT",
  transactionCode: "INVOIC",
  name: "Invoice",
  header: [
    {
      tag: "BGM",
      name: "Beginning of Message",
      required: true,
      elements: [
        { id: "BGM01", name: "Document Name Code", position: 1, dataType: "ID", required: true, fixedValue: "380" },
        { id: "BGM02", name: "Document Number", position: 2, dataType: "AN", maxLength: 35, required: true },
        { id: "BGM03", name: "Message Function Code", position: 3, dataType: "ID", required: true, fixedValue: "9" },
      ],
    },
    {
      tag: "NAD",
      name: "Name and Address (Seller)",
      required: false,
      elements: [
        { id: "NAD01", name: "Party Qualifier", position: 1, dataType: "ID", required: true, fixedValue: "SU" },
        { id: "NAD02", name: "Party ID", position: 2, dataType: "AN", maxLength: 35, required: true },
      ],
    },
  ],
  bodyLoop: {
    id: "LineItemLoop",
    repeating: true,
    segments: [
      {
        tag: "LIN",
        name: "Line Item",
        required: true,
        elements: [
          { id: "LIN01", name: "Line Number", position: 1, dataType: "AN", required: true },
          { id: "LIN03", name: "Item Number", position: 3, dataType: "AN", maxLength: 35, required: true },
        ],
      },
      {
        tag: "QTY",
        name: "Quantity",
        required: true,
        elements: [
          { id: "QTY01", name: "Quantity Qualifier", position: 1, dataType: "ID", required: true, fixedValue: "47" },
          { id: "QTY02", name: "Quantity", position: 2, dataType: "N0", required: true },
        ],
      },
    ],
  },
  trailer: [],
};

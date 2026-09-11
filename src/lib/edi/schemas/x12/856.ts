import type { EdiTransactionSchema } from "../../schemaTypes";

// V1 simplification: real X12 856 uses a multi-level HL hierarchy (Shipment ->
// Order -> Item). This tool's mapping engine only supports one repeating loop
// per transaction (single-level, index-aligned), so 856 is flattened here to a
// single item-level loop (LIN + SN1 per shipped item) with no order-level
// grouping. Document this limitation to users in the transaction picker UI.
export const X12_856: EdiTransactionSchema = {
  standard: "X12",
  transactionCode: "856",
  name: "Advance Ship Notice (item-level detail only, no order-level grouping)",
  header: [
    {
      tag: "BSN",
      name: "Beginning Segment for Ship Notice",
      required: true,
      elements: [
        { id: "BSN01", name: "Transaction Set Purpose Code", position: 1, dataType: "ID", required: true, fixedValue: "00" },
        { id: "BSN02", name: "Shipment ID Number", position: 2, dataType: "AN", maxLength: 30, required: true },
        { id: "BSN03", name: "Shipment Date", position: 3, dataType: "DT", required: true },
        { id: "BSN04", name: "Shipment Time", position: 4, dataType: "TM", required: true },
      ],
    },
  ],
  bodyLoop: {
    id: "ItemLoop",
    repeating: true,
    segments: [
      {
        tag: "LIN",
        name: "Item Identification",
        required: true,
        elements: [
          { id: "LIN01", name: "Line Number", position: 1, dataType: "AN", required: true },
          { id: "LIN02", name: "Product ID Qualifier", position: 2, dataType: "ID", required: true, fixedValue: "VP" },
          { id: "LIN03", name: "Product ID", position: 3, dataType: "AN", maxLength: 48, required: true },
        ],
      },
      {
        tag: "SN1",
        name: "Item Detail (Shipment)",
        required: true,
        elements: [
          { id: "SN102", name: "Quantity Shipped", position: 2, dataType: "N0", required: true },
          { id: "SN103", name: "Unit of Measure", position: 3, dataType: "ID", required: true },
        ],
      },
    ],
  },
  trailer: [
    {
      tag: "CTT",
      name: "Transaction Totals",
      required: false,
      elements: [{ id: "CTT01", name: "Number of Line Items", position: 1, dataType: "N0", required: true, derivedValue: "loopInstanceCount" }],
    },
    {
      tag: "SE",
      name: "Transaction Set Trailer",
      required: true,
      elements: [
        { id: "SE01", name: "Segment Count", position: 1, dataType: "N0", required: true, derivedValue: "segmentCount" },
        { id: "SE02", name: "Control Number", position: 2, dataType: "AN", required: true, derivedValue: "controlNumber" },
      ],
    },
  ],
};

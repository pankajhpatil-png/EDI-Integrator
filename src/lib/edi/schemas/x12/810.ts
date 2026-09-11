import type { EdiTransactionSchema } from "../../schemaTypes";

export const X12_810: EdiTransactionSchema = {
  standard: "X12",
  transactionCode: "810",
  name: "Invoice",
  header: [
    {
      tag: "BIG",
      name: "Beginning Segment for Invoice",
      required: true,
      elements: [
        { id: "BIG01", name: "Invoice Date", position: 1, dataType: "DT", required: true },
        { id: "BIG02", name: "Invoice Number", position: 2, dataType: "AN", maxLength: 22, required: true },
        { id: "BIG03", name: "Purchase Order Date", position: 3, dataType: "DT", required: false },
        { id: "BIG04", name: "Purchase Order Number", position: 4, dataType: "AN", maxLength: 22, required: false },
      ],
    },
    {
      tag: "N1",
      name: "Remit-To Name",
      required: false,
      elements: [
        { id: "N101", name: "Entity ID Code", position: 1, dataType: "ID", required: true, fixedValue: "RE" },
        { id: "N102", name: "Remit-To Name", position: 2, dataType: "AN", maxLength: 60, required: true },
      ],
    },
  ],
  bodyLoop: {
    id: "IT1Loop",
    repeating: true,
    segments: [
      {
        tag: "IT1",
        name: "Line Item",
        required: true,
        elements: [
          { id: "IT101", name: "Line Number", position: 1, dataType: "AN", required: true },
          { id: "IT102", name: "Quantity Invoiced", position: 2, dataType: "N0", required: true },
          { id: "IT103", name: "Unit of Measure", position: 3, dataType: "ID", required: true },
          { id: "IT104", name: "Unit Price", position: 4, dataType: "N2", required: false },
          { id: "IT107", name: "Product ID Qualifier", position: 7, dataType: "ID", required: false, fixedValue: "VP" },
          { id: "IT108", name: "Product ID", position: 8, dataType: "AN", maxLength: 48, required: false },
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

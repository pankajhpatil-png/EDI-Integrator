// Locally-defined delimiter shapes (this is a separate app from AI_EDI_Inspector,
// so these mirror its Delimiters/EdifactDelimiters shapes rather than importing them).

export interface X12Delimiters {
  element: string;
  subelement: string;
  terminator: string;
}

export const DEFAULT_X12_DELIMITERS: X12Delimiters = {
  element: "*",
  subelement: ">",
  terminator: "~",
};

export interface EdifactDelimiters {
  component: string;
  element: string;
  decimal: string;
  release: string;
  terminator: string;
}

export const DEFAULT_EDIFACT_DELIMITERS: EdifactDelimiters = {
  component: ":",
  element: "+",
  decimal: ".",
  release: "?",
  terminator: "'",
};

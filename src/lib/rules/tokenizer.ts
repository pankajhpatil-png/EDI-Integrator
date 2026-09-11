import { RuleSyntaxError } from "./types";

export type TokenType =
  | "NUMBER"
  | "STRING"
  | "IDENT"
  | "HASH"
  | "DOLLAR"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "EQ"
  | "EQEQ"
  | "NEQ"
  | "LT"
  | "LTE"
  | "GT"
  | "GTE"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "SEMI"
  | "DOT"
  | "IF"
  | "THEN"
  | "ELSE"
  | "END"
  | "AND"
  | "OR"
  | "NOT"
  | "TRUE"
  | "FALSE"
  | "SKIP"
  | "TYPE_INTEGER"
  | "TYPE_STRING"
  | "TYPE_REAL"
  | "TYPE_DATETIME"
  | "EOF";

export interface Token {
  type: TokenType;
  text: string;
  line: number;
  col: number;
}

// Keywords are case-insensitive (non-technical-friendly), variable/function names are
// case-sensitive (standard identifier convention, and needed to tell "GlobalTotal"
// apart from an accidental "globaltotal" typo instead of silently unifying them).
const KEYWORDS: Record<string, TokenType> = {
  IF: "IF",
  THEN: "THEN",
  ELSE: "ELSE",
  END: "END",
  AND: "AND",
  OR: "OR",
  NOT: "NOT",
  TRUE: "TRUE",
  FALSE: "FALSE",
  SKIP: "SKIP",
  INTEGER: "TYPE_INTEGER",
  STRING: "TYPE_STRING",
  REAL: "TYPE_REAL",
  DATETIME: "TYPE_DATETIME",
};

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isIdentStart(c: string): boolean {
  return /[A-Za-z_]/.test(c);
}

function isIdentPart(c: string): boolean {
  return /[A-Za-z0-9_]/.test(c);
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  function advance(): string {
    const c = source[i];
    i++;
    if (c === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return c;
  }

  function push(type: TokenType, text: string, startLine: number, startCol: number) {
    tokens.push({ type, text, line: startLine, col: startCol });
  }

  while (i < source.length) {
    const c = source[i];
    const startLine = line;
    const startCol = col;

    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      advance();
      continue;
    }

    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") advance();
      continue;
    }

    if (isDigit(c)) {
      let text = "";
      while (i < source.length && (isDigit(source[i]) || source[i] === ".")) text += advance();
      push("NUMBER", text, startLine, startCol);
      continue;
    }

    if (c === '"') {
      advance();
      let text = "";
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && i + 1 < source.length) {
          advance();
          text += advance();
        } else {
          text += advance();
        }
      }
      if (i >= source.length) throw new RuleSyntaxError("Unterminated string literal.", startLine, startCol);
      advance(); // closing quote
      push("STRING", text, startLine, startCol);
      continue;
    }

    if (isIdentStart(c)) {
      let text = "";
      while (i < source.length && isIdentPart(source[i])) text += advance();
      const keyword = KEYWORDS[text.toUpperCase()];
      push(keyword ?? "IDENT", text, startLine, startCol);
      continue;
    }

    if (c === "=" && source[i + 1] === "=") {
      advance();
      advance();
      push("EQEQ", "==", startLine, startCol);
      continue;
    }
    if (c === "!" && source[i + 1] === "=") {
      advance();
      advance();
      push("NEQ", "!=", startLine, startCol);
      continue;
    }
    if (c === "<" && source[i + 1] === "=") {
      advance();
      advance();
      push("LTE", "<=", startLine, startCol);
      continue;
    }
    if (c === ">" && source[i + 1] === "=") {
      advance();
      advance();
      push("GTE", ">=", startLine, startCol);
      continue;
    }

    const single: Partial<Record<string, TokenType>> = {
      "+": "PLUS",
      "-": "MINUS",
      "*": "STAR",
      "/": "SLASH",
      "=": "EQ",
      "<": "LT",
      ">": "GT",
      "(": "LPAREN",
      ")": "RPAREN",
      ",": "COMMA",
      ";": "SEMI",
      ".": "DOT",
      "#": "HASH",
      $: "DOLLAR",
    };
    if (single[c]) {
      advance();
      push(single[c]!, c, startLine, startCol);
      continue;
    }

    throw new RuleSyntaxError(`Unexpected character "${c}".`, startLine, startCol);
  }

  push("EOF", "", line, col);
  return tokens;
}

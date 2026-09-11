import type { DeclaredType } from "./types";

export type BinaryOp = "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "AND" | "OR";

export type Expr =
  | { kind: "NumberLit"; value: number }
  | { kind: "StringLit"; value: string }
  | { kind: "BoolLit"; value: boolean }
  | { kind: "RelativeRef"; field: string } // #Field
  | { kind: "AbsoluteRef"; path: string[]; field: string } // $Group.Block.#Field
  | { kind: "VarRef"; name: string } // bare identifier — local, else global
  | { kind: "Call"; name: string; args: Expr[] }
  | { kind: "Unary"; op: "-" | "NOT"; operand: Expr }
  | { kind: "Binary"; op: BinaryOp; left: Expr; right: Expr }
  // IF <cond> THEN <expr> ELSE <expr> END as a value (not a statement) — used by
  // mapping-edge transforms for a per-field conditional, e.g.
  // "IF #value == "US" THEN "USA" ELSE #value END". ELSE is mandatory here (a
  // ternary needs both branches), unlike the statement-form IF used in loop rules.
  | { kind: "Conditional"; condition: Expr; whenTrue: Expr; whenFalse: Expr };

export type Stmt =
  | { kind: "VarDecl"; varType: DeclaredType; name: string; init: Expr | null }
  | { kind: "Assign"; name: string; value: Expr }
  | { kind: "If"; condition: Expr; thenBranch: Stmt[]; elseBranch: Stmt[] | null }
  | { kind: "Skip" }
  | { kind: "ExprStmt"; expr: Expr };

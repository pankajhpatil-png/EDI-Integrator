import type { BinaryOp, Expr, Stmt } from "./ast";
import { tokenize, type Token, type TokenType } from "./tokenizer";
import { RuleSyntaxError, type DeclaredType } from "./types";

// Recursive-descent parser for the Extended Rules DSL (BRD section 2.2). Grammar:
//
//   program   := statement* EOF
//   statement := varDecl | ifStmt | skipStmt | assignment | exprStmt
//   varDecl   := ('Integer'|'String'|'Real'|'DateTime') IDENT ('=' expr)? ';'
//   ifStmt    := 'IF' expr 'THEN' statement* ('ELSE' statement*)? 'END' ';'
//   skipStmt  := 'SKIP' ';'
//   assignment:= IDENT '=' expr ';'
//   exprStmt  := expr ';'
//
//   expr      := or
//   or        := and ('OR' and)*
//   and       := not ('AND' not)*
//   not       := 'NOT' not | comparison
//   comparison:= additive (('=='|'!='|'<'|'<='|'>'|'>=') additive)?
//   additive  := multiplicative (('+'|'-') multiplicative)*
//   multiplicative := unary (('*'|'/') unary)*
//   unary     := '-' unary | primary
//   primary   := NUMBER | STRING | 'TRUE' | 'FALSE' | relativeRef | absoluteRef
//              | call | IDENT | '(' expr ')'
//   relativeRef := '#' IDENT
//   absoluteRef := '$' IDENT ('.' IDENT)* '.' '#' IDENT
//   call        := IDENT '(' (expr (',' expr)*)? ')'
//
// "END" (not "END IF") closes an if-block — there's no second block kind in V1 that
// would make "END IF" necessary to disambiguate.

const TYPE_TOKENS: Partial<Record<TokenType, DeclaredType>> = {
  TYPE_INTEGER: "integer",
  TYPE_STRING: "string",
  TYPE_REAL: "real",
  TYPE_DATETIME: "datetime",
};

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (t.type !== "EOF") this.pos++;
    return t;
  }

  private expect(type: TokenType, context: string): Token {
    if (!this.check(type)) {
      const t = this.peek();
      throw new RuleSyntaxError(`Expected ${type} ${context}, got ${t.type} "${t.text}".`, t.line, t.col);
    }
    return this.advance();
  }

  parseProgram(): Stmt[] {
    const statements: Stmt[] = [];
    while (!this.check("EOF")) statements.push(this.parseStatement());
    return statements;
  }

  private parseStatement(): Stmt {
    const declType = TYPE_TOKENS[this.peek().type];
    if (declType) return this.parseVarDecl(declType);
    if (this.check("IF")) return this.parseIf();
    if (this.check("SKIP")) return this.parseSkip();

    if (this.check("IDENT") && this.tokens[this.pos + 1]?.type === "EQ") {
      return this.parseAssignment();
    }

    const expr = this.parseExpr();
    this.expect("SEMI", "after expression");
    return { kind: "ExprStmt", expr };
  }

  private parseVarDecl(varType: DeclaredType): Stmt {
    this.advance(); // type keyword
    const name = this.expect("IDENT", "as variable name").text;
    let init: Expr | null = null;
    if (this.check("EQ")) {
      this.advance();
      init = this.parseExpr();
    }
    this.expect("SEMI", "after variable declaration");
    return { kind: "VarDecl", varType, name, init };
  }

  private parseAssignment(): Stmt {
    const name = this.expect("IDENT", "as assignment target").text;
    this.expect("EQ", "in assignment");
    const value = this.parseExpr();
    this.expect("SEMI", "after assignment");
    return { kind: "Assign", name, value };
  }

  private parseIf(): Stmt {
    this.advance(); // IF
    const condition = this.parseExpr();
    this.expect("THEN", "after IF condition");
    const thenBranch: Stmt[] = [];
    while (!this.check("ELSE") && !this.check("END")) thenBranch.push(this.parseStatement());
    let elseBranch: Stmt[] | null = null;
    if (this.check("ELSE")) {
      this.advance();
      elseBranch = [];
      while (!this.check("END")) elseBranch.push(this.parseStatement());
    }
    this.expect("END", "to close IF block");
    this.expect("SEMI", "after END");
    return { kind: "If", condition, thenBranch, elseBranch };
  }

  private parseSkip(): Stmt {
    this.advance();
    this.expect("SEMI", "after SKIP");
    return { kind: "Skip" };
  }

  private parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.check("OR")) {
      this.advance();
      left = { kind: "Binary", op: "OR", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.check("AND")) {
      this.advance();
      left = { kind: "Binary", op: "AND", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.check("NOT")) {
      this.advance();
      return { kind: "Unary", op: "NOT", operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private static readonly COMPARISON_OPS: Partial<Record<TokenType, BinaryOp>> = {
    EQEQ: "==",
    NEQ: "!=",
    LT: "<",
    LTE: "<=",
    GT: ">",
    GTE: ">=",
  };

  private parseComparison(): Expr {
    const left = this.parseAdditive();
    const op = Parser.COMPARISON_OPS[this.peek().type];
    if (!op) return left;
    this.advance();
    return { kind: "Binary", op, left, right: this.parseAdditive() };
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.check("PLUS") || this.check("MINUS")) {
      const op = this.advance().type === "PLUS" ? "+" : "-";
      left = { kind: "Binary", op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.check("STAR") || this.check("SLASH")) {
      const op = this.advance().type === "STAR" ? "*" : "/";
      left = { kind: "Binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.check("MINUS")) {
      this.advance();
      return { kind: "Unary", op: "-", operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const t = this.peek();

    if (t.type === "IF") return this.parseConditionalExpr();
    if (t.type === "NUMBER") {
      this.advance();
      return { kind: "NumberLit", value: Number(t.text) };
    }
    if (t.type === "STRING") {
      this.advance();
      return { kind: "StringLit", value: t.text };
    }
    if (t.type === "TRUE") {
      this.advance();
      return { kind: "BoolLit", value: true };
    }
    if (t.type === "FALSE") {
      this.advance();
      return { kind: "BoolLit", value: false };
    }
    if (t.type === "HASH") {
      this.advance();
      const field = this.expect("IDENT", "after #").text;
      return { kind: "RelativeRef", field };
    }
    if (t.type === "DOLLAR") {
      return this.parseAbsoluteRef();
    }
    if (t.type === "LPAREN") {
      this.advance();
      const expr = this.parseExpr();
      this.expect("RPAREN", "to close (");
      return expr;
    }
    if (t.type === "IDENT") {
      this.advance();
      if (this.check("LPAREN")) return this.parseCall(t.text);
      return { kind: "VarRef", name: t.text };
    }

    throw new RuleSyntaxError(`Unexpected token "${t.text || t.type}" in expression.`, t.line, t.col);
  }

  // IF <expr> THEN <expr> ELSE <expr> END — a ternary, not a block; ELSE is
  // mandatory and each branch is a single expr, no nested statements.
  private parseConditionalExpr(): Expr {
    this.advance(); // IF
    const condition = this.parseExpr();
    this.expect("THEN", "after IF condition");
    const whenTrue = this.parseExpr();
    this.expect("ELSE", "in conditional expression (ELSE is required)");
    const whenFalse = this.parseExpr();
    this.expect("END", "to close conditional expression");
    return { kind: "Conditional", condition, whenTrue, whenFalse };
  }

  private parseAbsoluteRef(): Expr {
    this.advance(); // $
    const path: string[] = [this.expect("IDENT", "after $").text];
    while (this.check("DOT") && this.tokens[this.pos + 1]?.type === "IDENT") {
      this.advance();
      path.push(this.expect("IDENT", "in absolute path").text);
    }
    this.expect("DOT", "before # in absolute reference");
    this.expect("HASH", "before final field in absolute reference");
    const field = this.expect("IDENT", "as absolute reference field").text;
    return { kind: "AbsoluteRef", path, field };
  }

  private parseCall(name: string): Expr {
    this.advance(); // (
    const args: Expr[] = [];
    if (!this.check("RPAREN")) {
      args.push(this.parseExpr());
      while (this.check("COMMA")) {
        this.advance();
        args.push(this.parseExpr());
      }
    }
    this.expect("RPAREN", "to close function call");
    return { kind: "Call", name, args };
  }

  // Entry point for a bare expression (no statements) — used by mapping-edge
  // transforms, which are always a single expr like "Trim(#value)" or "#value * #value2".
  parseStandaloneExpression(): Expr {
    const expr = this.parseExpr();
    this.expect("EOF", "at end of expression");
    return expr;
  }
}

export function parseRule(source: string): Stmt[] {
  const tokens = tokenize(source);
  return new Parser(tokens).parseProgram();
}

export function parseExpression(source: string): Expr {
  const tokens = tokenize(source);
  return new Parser(tokens).parseStandaloneExpression();
}

import { type CompareOp, type Expr, type Literal } from "./types";

/**
 * Recursive-descent parser for a small boolean targeting-rule language:
 *
 *   expr    :=  or
 *   or      :=  and ( "OR"  and )*
 *   and     :=  not ( "AND" not )*
 *   not     :=  "NOT" not | primary
 *   primary :=  "(" or ")" | leaf
 *   leaf    :=  field OP value        → structured `compare` node
 *            |  <anything else>       → verbatim `raw` node
 *
 * Keywords are case-insensitive and matched only on word boundaries at depth 0,
 * so `country == "SCOTLAND"` is a single leaf even though "AND" appears inside
 * the value. The parser is total: input it cannot structure is never dropped or
 * rejected — it is captured verbatim as a `raw` node.
 */
export function parse(source: string): Expr {
  // Unbalanced parens/brackets/quotes can't be structured safely — keep the
  // whole thing verbatim rather than lose or mangle it.
  if (!isBalanced(source)) return { type: "raw", source: source.trim() };
  return new Parser(source).parseTop();
}

const WORD = /[A-Za-z0-9_]/;

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  parseTop(): Expr {
    const e = this.parseOr();
    this.skipWs();
    if (this.i < this.s.length) return { type: "raw", source: this.s.trim() };
    return e;
  }

  private skipWs(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  /** If a boolean keyword sits at (or just after whitespace from) position `at`,
   *  return it. Pure — never moves the cursor. */
  private keywordAt(at: number): "AND" | "OR" | "NOT" | null {
    let j = at;
    while (j < this.s.length && /\s/.test(this.s[j])) j++;
    const m = /^[A-Za-z]+/.exec(this.s.slice(j));
    if (!m) return null;
    const word = m[0].toUpperCase();
    if (word !== "AND" && word !== "OR" && word !== "NOT") return null;
    const after = this.s[j + m[0].length];
    if (after !== undefined && WORD.test(after)) return null; // e.g. "ANDes"
    return word;
  }

  private peekKeyword(): "AND" | "OR" | "NOT" | null {
    return this.keywordAt(this.i);
  }

  private consumeKeyword(): void {
    this.skipWs();
    const m = /^[A-Za-z]+/.exec(this.s.slice(this.i));
    if (m) this.i += m[0].length;
  }

  private parseOr(): Expr {
    const nodes = [this.parseAnd()];
    while (this.peekKeyword() === "OR") {
      this.consumeKeyword();
      nodes.push(this.parseAnd());
    }
    return nodes.length === 1 ? nodes[0] : { type: "or", nodes };
  }

  private parseAnd(): Expr {
    const nodes = [this.parseNot()];
    while (this.peekKeyword() === "AND") {
      this.consumeKeyword();
      nodes.push(this.parseNot());
    }
    return nodes.length === 1 ? nodes[0] : { type: "and", nodes };
  }

  private parseNot(): Expr {
    if (this.peekKeyword() === "NOT") {
      this.consumeKeyword();
      return { type: "not", node: this.parseNot() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    this.skipWs();
    if (this.s[this.i] === "(") {
      const inner = this.readBalanced();
      return parse(inner);
    }
    return this.parseLeaf();
  }

  /** Read a parenthesised group, returning its inner text (parens stripped). */
  private readBalanced(): string {
    const start = this.i;
    let depth = 0;
    let quote: string | null = null;
    for (; this.i < this.s.length; this.i++) {
      const c = this.s[this.i];
      if (quote) {
        if (c === "\\") this.i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) {
          const inner = this.s.slice(start + 1, this.i);
          this.i++; // consume ')'
          return inner;
        }
      }
    }
    return this.s.slice(start + 1);
  }

  /** Scan a leaf up to the next depth-0 boolean keyword or closing paren. */
  private parseLeaf(): Expr {
    this.skipWs();
    const start = this.i;
    let depth = 0;
    let quote: string | null = null;
    for (; this.i < this.s.length; this.i++) {
      const c = this.s[this.i];
      if (quote) {
        if (c === "\\") this.i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
      } else if (c === "(" || c === "[") {
        depth++;
      } else if (c === ")" || c === "]") {
        if (depth === 0) break; // closing paren of an enclosing group
        depth--;
      } else if (depth === 0 && /\s/.test(c)) {
        const kw = this.keywordAt(this.i);
        if (kw === "AND" || kw === "OR") break;
      }
    }
    return classifyLeaf(this.s.slice(start, this.i).trim());
  }
}

/** Are all parens, brackets and quotes balanced? */
function isBalanced(s: string): boolean {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0 && quote === null;
}

/** Turn a leaf's raw text into a structured `compare` node when it fits the
 *  simple grammar, otherwise preserve it verbatim as a `raw` node. */
export function classifyLeaf(text: string): Expr {
  const fieldMatch = /^([A-Za-z_][A-Za-z0-9_.]*)\s*/.exec(text);
  if (!fieldMatch) return { type: "raw", source: text };
  const field = fieldMatch[1];
  let rest = text.slice(fieldMatch[0].length);

  const op = matchOp(rest);
  if (!op) return { type: "raw", source: text };
  rest = rest.slice(op.length).trim();

  const value = parseLiteral(rest);
  if (value === NO_MATCH) return { type: "raw", source: text };

  return { type: "compare", field, op: normalizeOp(op), value };
}

function matchOp(s: string): string | null {
  for (const two of ["==", "!=", "<=", ">="]) {
    if (s.startsWith(two)) return two;
  }
  if (s.startsWith("<") || s.startsWith(">")) return s[0];
  const word = /^in\b/i.exec(s);
  if (word) return word[0];
  return null;
}

function normalizeOp(op: string): CompareOp {
  return op.toLowerCase() === "in" ? "in" : (op as CompareOp);
}

const NO_MATCH = Symbol("no-match");

function parseLiteral(raw: string): Literal | typeof NO_MATCH {
  const s = raw.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    const parts = splitTopLevelCommas(s.slice(1, -1));
    const out: Array<string | number | boolean> = [];
    for (const part of parts) {
      const scalar = parseScalar(part);
      if (scalar === NO_MATCH) return NO_MATCH;
      out.push(scalar);
    }
    return out;
  }
  return parseScalar(s);
}

function parseScalar(raw: string): string | number | boolean | typeof NO_MATCH {
  const s = raw.trim();
  if (s === "") return NO_MATCH;
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    const quote = s[0];
    if (s.length < 2) return NO_MATCH;
    // The closing quote must be the first unescaped quote — no trailing junk.
    for (let i = 1; i < s.length - 1; i++) {
      if (s[i] === "\\") {
        i++;
        continue;
      }
      if (s[i] === quote) return NO_MATCH;
    }
    return s.slice(1, -1).replace(/\\(["'\\])/g, "$1");
  }
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return Number(s);
  if (s === "true") return true;
  if (s === "false") return false;
  return NO_MATCH;
}

function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === "," && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

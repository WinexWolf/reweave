import { type Expr, type Literal } from "./types";

/**
 * Serialize an AST back to canonical source text. Deterministic, so it acts as a
 * normal form: `parse(serialize(parse(s)))` equals `parse(s)`. Precedence
 * (OR < AND < NOT < leaf) is restored with the minimum parentheses needed, and
 * `raw` nodes are emitted byte-for-byte.
 */
export function serialize(expr: Expr): string {
  switch (expr.type) {
    case "raw":
      return expr.source;
    case "compare":
      return `${expr.field} ${expr.op} ${serializeLiteral(expr.value)}`;
    case "not": {
      const inner = expr.node;
      const needsParens = inner.type === "and" || inner.type === "or";
      const s = serialize(inner);
      return `NOT ${needsParens ? `(${s})` : s}`;
    }
    case "and":
      return expr.nodes
        .map((n) => wrap(n, n.type === "or"))
        .join(" AND ");
    case "or":
      return expr.nodes.map((n) => serialize(n)).join(" OR ");
  }
}

function wrap(expr: Expr, needsParens: boolean): string {
  const s = serialize(expr);
  return needsParens ? `(${s})` : s;
}

function serializeLiteral(value: Literal): string {
  if (Array.isArray(value)) {
    return `[${value.map(serializeScalar).join(", ")}]`;
  }
  return serializeScalar(value);
}

function serializeScalar(value: string | number | boolean): string {
  if (typeof value === "string") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return String(value);
}

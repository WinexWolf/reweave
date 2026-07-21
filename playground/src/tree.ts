import { type Expr, type Literal } from "reweave";

/** A path into an Expr tree: numbers index `and`/`or` children; "node" steps
 *  into a `not`. */
export type Path = (number | "node")[];

const DEFAULT_COMPARE: Expr = {
  type: "compare",
  field: "field",
  op: "==",
  value: "value",
};

/** Immutably replace (or delete, when `fn` returns null) the node at `path`.
 *  Empty `and`/`or` groups collapse; a single-child group unwraps. */
export function updateAt(
  root: Expr,
  path: Path,
  fn: (n: Expr) => Expr | null,
): Expr | null {
  if (path.length === 0) return fn(root);
  const [head, ...rest] = path;

  if (head === "node") {
    if (root.type !== "not") return root;
    const child = updateAt(root.node, rest, fn);
    if (child === null) return null;
    return { ...root, node: child };
  }

  if (root.type !== "and" && root.type !== "or") return root;
  const child = updateAt(root.nodes[head], rest, fn);
  const nodes = root.nodes.slice();
  if (child === null) nodes.splice(head, 1);
  else nodes[head] = child;
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  return { ...root, nodes };
}

/** Top-level convenience: never lets the tree become empty. */
export function mutate(
  root: Expr,
  path: Path,
  fn: (n: Expr) => Expr | null,
): Expr {
  return updateAt(root, path, fn) ?? DEFAULT_COMPARE;
}

export function newCondition(): Expr {
  return { ...DEFAULT_COMPARE };
}

// ── literal ⇄ text (for the value inputs) ───────────────────────────────────

export function literalToText(value: Literal): string {
  if (Array.isArray(value)) return value.map(scalarToText).join(", ");
  return scalarToText(value);
}

function scalarToText(v: string | number | boolean): string {
  return typeof v === "string" ? `"${v}"` : String(v);
}

export function textToLiteral(text: string): Literal {
  const t = text.trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    return t
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(scalarFromText);
  }
  return scalarFromText(t);
}

function scalarFromText(t: string): string | number | boolean {
  const s = t.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === "true") return true;
  if (s === "false") return false;
  return s;
}

// ── flattening (for the table + graph views) ────────────────────────────────

export type Leaf = {
  node: Extract<Expr, { type: "compare" } | { type: "raw" }>;
  path: Path;
  context: ("AND" | "OR" | "NOT")[];
};

/** Collect every leaf (compare / raw) with its path and the chain of operators
 *  above it — so a flat view can show a leaf's logical context. */
export function collectLeaves(
  root: Expr,
  path: Path = [],
  context: ("AND" | "OR" | "NOT")[] = [],
): Leaf[] {
  switch (root.type) {
    case "compare":
    case "raw":
      return [{ node: root, path, context }];
    case "not":
      return collectLeaves(root.node, [...path, "node"], [...context, "NOT"]);
    case "and":
      return root.nodes.flatMap((n, i) =>
        collectLeaves(n, [...path, i], [...context, "AND"]),
      );
    case "or":
      return root.nodes.flatMap((n, i) =>
        collectLeaves(n, [...path, i], [...context, "OR"]),
      );
  }
}

/** The rule-expression AST.
 *
 * `compare` nodes are the part the editor fully understands and can render as
 * structured fields. Anything the grammar does not model — function calls,
 * regular expressions, vendor-specific accessors — is captured as a `raw` node
 * and carried through byte-for-byte. That verbatim carry-through is the whole
 * point: a partial editor must never silently drop or rewrite what it cannot
 * represent.
 */
export type CompareOp = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in";

export type Literal = string | number | boolean | Array<string | number | boolean>;

export type Expr =
  | { type: "and"; nodes: Expr[] }
  | { type: "or"; nodes: Expr[] }
  | { type: "not"; node: Expr }
  | { type: "compare"; field: string; op: CompareOp; value: Literal }
  | { type: "raw"; source: string };

export const COMPARE_OPS: CompareOp[] = ["==", "!=", "<=", ">=", "<", ">", "in"];

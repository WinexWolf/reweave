import { type Json, type Op, diff } from "../ops";
import { type Lens } from "../lens";
import { type Expr } from "./types";
import { parse } from "./parse";
import { serialize } from "./serialize";

/**
 * The flagship lens: it projects a rule-expression *string* into an editable AST
 * and folds edits back into a string, emitting the minimal operation log.
 *
 *   const view = exprLens.get('country == "US" AND geo.near(hq, 50km)');
 *   // → and[ compare(country == "US"), raw("geo.near(hq, 50km)") ]
 *   //   the vendor accessor the editor can't model is preserved verbatim.
 *
 *   view.nodes.push({ type: "compare", field: "plan", op: "==", value: "pro" });
 *   const { model, ops } = exprLens.put(original, view);
 *   // model = 'country == "US" AND geo.near(hq, 50km) AND plan == "pro"'
 *   // ops   = [{ op: "add", path: "/nodes/2", value: {…} }]
 */
export const exprLens: Lens<string, Expr> = {
  get(model: string): Expr {
    return parse(model);
  },

  put(model: string, view: Expr): { model: string; ops: Op[] } {
    const before = parse(model) as unknown as Json;
    const after = view as unknown as Json;
    return { model: serialize(view), ops: diff(before, after) };
  },

  // Parsing drops redundant whitespace/parens, so the canonical view of an edit
  // is "parse what it serializes to".
  canonicalize(view: Expr): Expr {
    return parse(serialize(view));
  },
};

export type { Expr } from "./types";

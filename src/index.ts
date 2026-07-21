/**
 * reweave — lossless partial editing for structured documents.
 *
 * Edit a friendly projection of a document, get back a minimal diff, and keep
 * everything the editor doesn't model — verbatim.
 */

// Minimal-diff engine
export { diff, apply, deepEqual, type Op, type Json } from "./ops";

// Lens core + round-trip laws
export {
  type Lens,
  type PutResult,
  holdsGetPut,
  holdsPutGet,
} from "./lens";

// Expression lens (flagship)
export { parse } from "./expr/parse";
export { serialize } from "./expr/serialize";
export { exprLens } from "./expr/lens";
export {
  type Expr,
  type CompareOp,
  type Literal,
  COMPARE_OPS,
} from "./expr/types";

// Config lens (partial projection)
export { configLens } from "./json/lens";

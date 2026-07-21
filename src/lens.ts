/**
 * A lens is a bidirectional transformation between a stored `Model` (the source
 * of truth — a string, a config object, …) and a `View` that is convenient to
 * edit (a tree, a form model, …).
 *
 *   get : Model → View                 project the editable view
 *   put : (Model, View) → Model + Ops  fold an edited view back into the model
 *
 * Reweave lenses obey two round-trip laws, adapted from the bidirectional-lens
 * literature (Foster et al.). They are what make "lossless" a checkable claim
 * rather than a slogan:
 *
 *   GetPut  put(m, get(m))  changes nothing        (no edit ⇒ no diff)
 *   PutGet  get(put(m, v))  equals canonicalize(v) (what you see is what you saved)
 *
 * `put` additionally returns the minimal operation log describing the change, so
 * a backend can persist a small patch and enforce optimistic concurrency.
 */
import { type Json, type Op, deepEqual } from "./ops";

export interface PutResult<M extends Json> {
  model: M;
  ops: Op[];
}

export interface Lens<M extends Json, V extends Json> {
  get(model: M): V;
  put(model: M, view: V): PutResult<M>;
  /** Optional normal form used by the PutGet law when `put` may reshape a view
   *  (e.g. a parser dropping redundant parentheses). Defaults to identity. */
  canonicalize?(view: V): V;
}

/** GetPut: projecting a model and immediately folding it back is a no-op. */
export function holdsGetPut<M extends Json, V extends Json>(
  lens: Lens<M, V>,
  model: M,
): boolean {
  const { model: after, ops } = lens.put(model, lens.get(model));
  return ops.length === 0 && deepEqual(after, model);
}

/** PutGet: after folding an edited view in, projecting it back returns that view
 *  (up to the lens's canonical form). "What you see is what you saved." */
export function holdsPutGet<M extends Json, V extends Json>(
  lens: Lens<M, V>,
  model: M,
  view: V,
): boolean {
  const canon = lens.canonicalize ?? ((v: V) => v);
  const { model: next } = lens.put(model, view);
  return deepEqual(lens.get(next), canon(view));
}

import { parseDocument, isSeq, type Document } from "yaml";
import { type Json, type Op, diff } from "../ops";
import { type Lens } from "../lens";

/**
 * A lossless lens over a YAML *document string*.
 *
 * `get` projects the document's data as plain JSON (optionally restricted to a
 * set of top-level keys). `put` folds an edited view back into the **original
 * source** — applying only the changed paths to the parsed CST — so comments,
 * key order, quoting styles and every untouched line survive byte-for-byte.
 *
 *   const lens = yamlLens();
 *   const view = lens.get(source);   // { name: "acme-api", replicas: 3, ... }
 *   view.replicas = 5;
 *   const { model, ops } = lens.put(source, view);
 *   // model: the same file with `replicas: 5` — every comment intact
 *   // ops:   [{ op: "replace", path: "/replicas", value: 5, prev: 3 }]
 *
 * Requires the peer dependency `yaml` (>= 2). The core `reweave` entry point
 * pulls in nothing; only this adapter needs it.
 */
export interface YamlLensOptions {
  /** Restrict the editable projection to these top-level keys. Everything else
   *  in the document is preserved and never diffed. */
  editable?: string[];
}

export function yamlLens(
  options: YamlLensOptions = {},
): Lens<string, { [k: string]: Json }> {
  const { editable } = options;

  const project = (data: Json): { [k: string]: Json } => {
    const obj =
      data && typeof data === "object" && !Array.isArray(data) ? data : {};
    if (!editable) return { ...obj };
    const view: { [k: string]: Json } = {};
    for (const key of editable) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) view[key] = obj[key];
    }
    return view;
  };

  const getData = (source: string): { [k: string]: Json } =>
    project((parseDocument(source).toJSON() ?? {}) as Json);

  return {
    get(source) {
      return getData(source);
    },

    put(source, view) {
      const before = getData(source);
      const ops = diff(before, view);
      // No data change ⇒ return the source untouched. This guarantees an exact
      // round-trip (no incidental reformatting) when nothing was edited.
      if (ops.length === 0) return { model: source, ops: [] };

      const doc = parseDocument(source);
      for (const op of ops) applyOp(doc, op);
      return { model: String(doc), ops };
    },
  };
}

// ── apply a JSON-Patch op to a yaml Document, surgically ─────────────────────

function applyOp(doc: Document, op: Op): void {
  const tokens = pointerToTokens(op.path);

  if (tokens.length === 0) {
    // Whole-document replacement (only when the root type itself changed).
    if (op.op !== "remove") doc.contents = doc.createNode(op.value);
    return;
  }

  if (op.op === "remove") {
    doc.deleteIn(tokens);
    return;
  }

  if (op.op === "add") {
    const parent = tokens.slice(0, -1);
    const last = tokens[tokens.length - 1];
    const container = parent.length ? doc.getIn(parent, true) : doc.contents;
    if (isSeq(container) && typeof last === "number") {
      // Insert into a sequence at the given index, preserving siblings.
      container.items.splice(last, 0, doc.createNode(op.value));
      return;
    }
    doc.setIn(tokens, op.value);
    return;
  }

  // replace
  doc.setIn(tokens, op.value);
}

/** JSON Pointer → token path, coercing all-digit tokens to numbers so they
 *  address sequence indices. */
function pointerToTokens(path: string): (string | number)[] {
  if (path === "") return [];
  return path
    .split("/")
    .slice(1)
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"))
    .map((t) => (/^\d+$/.test(t) ? Number(t) : t));
}

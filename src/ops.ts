/**
 * Minimal structural diff over JSON values.
 *
 * `diff(a, b)` returns the smallest reasonable set of operations that turns `a`
 * into `b`, expressed as RFC 6902-style JSON Patch operations addressed by RFC
 * 6901 JSON Pointers. Every operation also carries the value it replaced
 * (`prev`) so a caller can implement optimistic concurrency: reject the patch if
 * the stored value has drifted from `prev`.
 *
 * The law that anchors everything: `apply(a, diff(a, b))` deep-equals `b`.
 */

export type Op =
  | { op: "add"; path: string; value: Json }
  | { op: "remove"; path: string; prev: Json }
  | { op: "replace"; path: string; value: Json; prev: Json };

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

function isObject(v: Json): v is { [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** RFC 6901 token escaping. */
function escape(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

function ptr(base: string, token: string | number): string {
  return `${base}/${escape(String(token))}`;
}

export function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]),
    );
  }
  return false;
}

function clone<T extends Json>(v: T): T {
  return structuredClone(v);
}

/** Longest common subsequence of two arrays, compared by deep equality.
 *  Returns the matched index pairs `[i, j]` in ascending order. */
function lcs(a: Json[], b: Json[]): Array<[number, number]> {
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      table[i][j] = deepEqual(a[i], b[j])
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (deepEqual(a[i], b[j])) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

function diffArray(a: Json[], b: Json[], base: string): Op[] {
  // Equal length: prefer positional, recursive diffs so that editing one field
  // of one element yields a single `replace` deep inside — not a remove + add of
  // the whole element.
  if (a.length === b.length) {
    const ops: Op[] = [];
    for (let i = 0; i < a.length; i++) {
      ops.push(...diff(a[i], b[i], ptr(base, i)));
    }
    return ops;
  }

  // Different length: use the LCS to remove/insert whole elements minimally.
  // Removes are emitted in descending index order and adds in ascending order
  // so the operations apply correctly in sequence.
  const kept = lcs(a, b);
  const keptA = new Set(kept.map(([i]) => i));
  const keptB = new Set(kept.map(([, j]) => j));

  const ops: Op[] = [];
  for (let i = a.length - 1; i >= 0; i--) {
    if (!keptA.has(i)) ops.push({ op: "remove", path: ptr(base, i), prev: a[i] });
  }
  for (let j = 0; j < b.length; j++) {
    if (!keptB.has(j)) ops.push({ op: "add", path: ptr(base, j), value: b[j] });
  }
  return ops;
}

function hasOwn(obj: { [k: string]: Json }, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function diffObject(
  a: { [k: string]: Json },
  b: { [k: string]: Json },
  base: string,
): Op[] {
  const ops: Op[] = [];
  for (const key of Object.keys(a)) {
    if (!hasOwn(b, key)) ops.push({ op: "remove", path: ptr(base, key), prev: a[key] });
  }
  for (const key of Object.keys(b)) {
    if (hasOwn(a, key)) ops.push(...diff(a[key], b[key], ptr(base, key)));
    else ops.push({ op: "add", path: ptr(base, key), value: b[key] });
  }
  return ops;
}

/** Compute the minimal operation list turning `a` into `b`. */
export function diff(a: Json, b: Json, base = ""): Op[] {
  if (deepEqual(a, b)) return [];
  if (Array.isArray(a) && Array.isArray(b)) return diffArray(a, b, base);
  if (isObject(a) && isObject(b)) return diffObject(a, b, base);
  return [{ op: "replace", path: base, value: clone(b), prev: clone(a) }];
}

// ── Applying operations ─────────────────────────────────────────────────────

function unescape(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

function parsePointer(path: string): string[] {
  if (path === "") return [];
  return path.split("/").slice(1).map(unescape);
}

function getParent(root: { ref: Json }, tokens: string[]): Json {
  let node: Json = root.ref;
  for (const token of tokens.slice(0, -1)) {
    if (Array.isArray(node)) node = node[Number(token)];
    else if (isObject(node)) node = node[token];
    else throw new Error(`cannot descend into ${JSON.stringify(node)} at ${token}`);
  }
  return node;
}

/** Apply an operation list to a document, returning a new document. Pure. */
export function apply(doc: Json, ops: Op[]): Json {
  const root = { ref: clone(doc) };
  for (const op of ops) {
    const tokens = parsePointer(op.path);
    if (tokens.length === 0) {
      if (op.op === "remove") throw new Error("cannot remove the document root");
      root.ref = clone((op as { value: Json }).value);
      continue;
    }
    const parent = getParent(root, tokens);
    const last = tokens[tokens.length - 1];
    if (Array.isArray(parent)) {
      const idx = last === "-" ? parent.length : Number(last);
      if (op.op === "add") parent.splice(idx, 0, clone(op.value));
      else if (op.op === "remove") parent.splice(idx, 1);
      else parent[idx] = clone(op.value);
    } else if (isObject(parent)) {
      if (op.op === "remove") delete parent[last];
      else parent[last] = clone(op.value);
    } else {
      throw new Error(`cannot apply ${op.op} at ${op.path}`);
    }
  }
  return root.ref;
}

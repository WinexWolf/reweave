import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { diff, apply, deepEqual, type Json } from "../src/ops";

describe("diff / apply", () => {
  it("no change ⇒ no ops", () => {
    expect(diff({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("replace at a leaf", () => {
    expect(diff({ a: 1 }, { a: 2 })).toEqual([
      { op: "replace", path: "/a", value: 2, prev: 1 },
    ]);
  });

  it("add and remove keys", () => {
    expect(diff({ a: 1 }, { b: 2 })).toEqual([
      { op: "remove", path: "/a", prev: 1 },
      { op: "add", path: "/b", value: 2 },
    ]);
  });

  it("recurses into equal-length arrays (one deep replace, not a rewrite)", () => {
    const before = { rules: [{ v: 1 }, { v: 2 }] };
    const after = { rules: [{ v: 1 }, { v: 9 }] };
    expect(diff(before, after)).toEqual([
      { op: "replace", path: "/rules/1/v", value: 9, prev: 2 },
    ]);
  });

  it("inserts one array element without touching its neighbours", () => {
    const before = ["a", "b", "c"];
    const after = ["a", "x", "b", "c"];
    const ops = diff(before, after);
    expect(ops).toEqual([{ op: "add", path: "/1", value: "x" }]);
  });

  it("escapes JSON Pointer tokens", () => {
    expect(diff({ "a/b": 1 }, { "a/b": 2 })).toEqual([
      { op: "replace", path: "/a~1b", value: 2, prev: 1 },
    ]);
  });

  it("law: apply(a, diff(a, b)) deep-equals b", () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.jsonValue(), (a, b) => {
        const ja = a as Json;
        const jb = b as Json;
        expect(deepEqual(apply(ja, diff(ja, jb)), jb)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});

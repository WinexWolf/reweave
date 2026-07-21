import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { exprLens } from "../src/expr/lens";
import { configLens } from "../src/json/lens";
import { holdsGetPut, holdsPutGet } from "../src/lens";
import { type Json } from "../src/ops";
import { type Expr } from "../src/expr/types";
import { serialize } from "../src/expr/serialize";
import { exprArb } from "./expr.test";

describe("exprLens", () => {
  it("get projects a string to an editable AST", () => {
    expect(exprLens.get('plan == "pro"')).toEqual({
      type: "compare",
      field: "plan",
      op: "==",
      value: "pro",
    });
  });

  it("an edit yields a minimal op-log and preserves raw siblings", () => {
    const source = 'country == "US" AND geo.near(hq, 50) AND plan == "free"';
    const view = exprLens.get(source) as Extract<Expr, { type: "and" }>;
    // change the last comparison's value in the projected tree
    const last = view.nodes[2] as Extract<Expr, { type: "compare" }>;
    last.value = "pro";

    const { model, ops } = exprLens.put(source, view);
    expect(model).toBe(
      'country == "US" AND geo.near(hq, 50) AND plan == "pro"',
    );
    // exactly one operation, addressed at the changed node — the raw accessor
    // is untouched and carried through verbatim.
    expect(ops).toEqual([
      { op: "replace", path: "/nodes/2/value", value: "pro", prev: "free" },
    ]);
  });

  it("law: GetPut — projecting and folding back changes nothing", () => {
    fc.assert(
      fc.property(exprArb, (ast) => {
        const source = serialize(ast);
        expect(holdsGetPut(exprLens as never, source as never)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("law: PutGet — what you see is what you saved", () => {
    fc.assert(
      fc.property(exprArb, (ast) => {
        const source = serialize(ast);
        expect(holdsPutGet(exprLens as never, source as never, ast as never)).toBe(
          true,
        );
      }),
      { numRuns: 300 },
    );
  });
});

describe("configLens", () => {
  const lens = configLens(["name", "version"]);

  it("projects only the editable keys", () => {
    const doc = { name: "app", version: "1.0.0", private: true, scripts: {} };
    expect(lens.get(doc)).toEqual({ name: "app", version: "1.0.0" });
  });

  it("preserves unknown keys verbatim and emits a minimal diff", () => {
    const doc: { [k: string]: Json } = {
      name: "app",
      version: "1.0.0",
      private: true,
      customField: { deeply: ["nested", "data"] },
    };
    const view = lens.get(doc);
    view.version = "1.1.0";

    const { model, ops } = lens.put(doc, view);
    expect(model).toEqual({
      name: "app",
      version: "1.1.0",
      private: true,
      customField: { deeply: ["nested", "data"] },
    });
    expect(ops).toEqual([
      { op: "replace", path: "/version", value: "1.1.0", prev: "1.0.0" },
    ]);
  });

  it("refuses to write keys it was not given authority over", () => {
    const doc = { name: "app", version: "1.0.0" };
    expect(() =>
      lens.put(doc, { name: "app", version: "1.0.0", private: true }),
    ).toThrow(/not editable/);
  });

  it("law: GetPut holds over arbitrary documents", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom("name", "version", "extra", "nested"),
          fc.jsonValue() as fc.Arbitrary<Json>,
        ),
        (doc) => {
          expect(holdsGetPut(lens, doc)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});

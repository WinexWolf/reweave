import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parse } from "../src/expr/parse";
import { serialize } from "../src/expr/serialize";
import { type Expr, COMPARE_OPS } from "../src/expr/types";

describe("parse", () => {
  it("structures a simple comparison", () => {
    expect(parse('country == "US"')).toEqual({
      type: "compare",
      field: "country",
      op: "==",
      value: "US",
    });
  });

  it("parses numbers, booleans and lists", () => {
    expect(parse("age >= 18")).toEqual({
      type: "compare",
      field: "age",
      op: ">=",
      value: 18,
    });
    expect(parse("enabled == true")).toEqual({
      type: "compare",
      field: "enabled",
      op: "==",
      value: true,
    });
    expect(parse('country in ["US", "CA", "GB"]')).toEqual({
      type: "compare",
      field: "country",
      op: "in",
      value: ["US", "CA", "GB"],
    });
  });

  it("respects precedence (OR < AND) and grouping", () => {
    expect(parse('a == 1 AND b == 2 OR c == 3')).toEqual({
      type: "or",
      nodes: [
        {
          type: "and",
          nodes: [
            { type: "compare", field: "a", op: "==", value: 1 },
            { type: "compare", field: "b", op: "==", value: 2 },
          ],
        },
        { type: "compare", field: "c", op: "==", value: 3 },
      ],
    });
    expect(parse('a == 1 AND (b == 2 OR c == 3)')).toEqual({
      type: "and",
      nodes: [
        { type: "compare", field: "a", op: "==", value: 1 },
        {
          type: "or",
          nodes: [
            { type: "compare", field: "b", op: "==", value: 2 },
            { type: "compare", field: "c", op: "==", value: 3 },
          ],
        },
      ],
    });
  });

  it("preserves what it cannot model as a raw node — verbatim", () => {
    const expr = parse('country == "US" AND geo.near(hq, 50km)');
    expect(expr).toEqual({
      type: "and",
      nodes: [
        { type: "compare", field: "country", op: "==", value: "US" },
        { type: "raw", source: "geo.near(hq, 50km)" },
      ],
    });
  });

  it("does not mistake keywords inside string values for operators", () => {
    expect(parse('city == "SAND AND OROVILLE"')).toEqual({
      type: "compare",
      field: "city",
      op: "==",
      value: "SAND AND OROVILLE",
    });
  });

  it("keeps an unparseable whole expression rather than dropping it", () => {
    // trailing junk after a valid group ⇒ preserved verbatim
    expect(parse("((("))
      .toEqual({ type: "raw", source: "(((" });
  });
});

// A generator of *canonical* ASTs — the shape `parse` itself produces (no
// same-operator nesting, AND/OR with ≥2 children). These sources round-trip
// exactly, which is what the lens laws depend on.
const scalar = fc.oneof(
  fc.string(),
  fc.integer(),
  fc
    .double({ noNaN: true, noDefaultInfinity: true })
    .map((d) => (Object.is(d, -0) ? 0 : d)),
  fc.boolean(),
);
const compareArb: fc.Arbitrary<Expr> = fc.record({
  type: fc.constant("compare" as const),
  field: fc.constantFrom("country", "plan", "age", "geo.lat", "user_id"),
  op: fc.constantFrom(...COMPARE_OPS),
  value: fc.oneof(scalar, fc.array(scalar, { minLength: 1, maxLength: 3 })),
});
const rawArb: fc.Arbitrary<Expr> = fc
  .constantFrom(
    "geo.near(hq, 50)",
    "matches(email, /@corp/)",
    "risk.score(model_v2) > threshold(region)",
    "segment(vip)",
  )
  .map((source) => ({ type: "raw" as const, source }));

const exprArb: fc.Arbitrary<Expr> = fc.letrec((tie) => {
  const t = (k: string) => tie(k) as fc.Arbitrary<Expr>;
  return {
    leaf: fc.oneof(compareArb, rawArb),
    not: fc
      .oneof(t("leaf"), t("and"), t("or"))
      .map((node): Expr => ({ type: "not", node })),
    and: fc
      .array(fc.oneof(t("leaf"), t("not"), t("or")), {
        minLength: 2,
        maxLength: 3,
      })
      .map((nodes): Expr => ({ type: "and", nodes })),
    or: fc
      .array(fc.oneof(t("leaf"), t("not"), t("and")), {
        minLength: 2,
        maxLength: 3,
      })
      .map((nodes): Expr => ({ type: "or", nodes })),
    expr: fc.oneof(t("leaf"), t("not"), t("and"), t("or")),
  };
}).expr as fc.Arbitrary<Expr>;

describe("parse ∘ serialize", () => {
  it("law: parse(serialize(ast)) deep-equals ast for canonical ASTs", () => {
    fc.assert(
      fc.property(exprArb, (ast) => {
        expect(parse(serialize(ast))).toEqual(ast);
      }),
      { numRuns: 500 },
    );
  });

  it("law: serialize is idempotent under re-parsing", () => {
    fc.assert(
      fc.property(exprArb, (ast) => {
        const once = serialize(ast);
        expect(serialize(parse(once))).toBe(once);
      }),
      { numRuns: 500 },
    );
  });
});

export { exprArb };

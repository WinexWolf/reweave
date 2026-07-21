import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { yamlLens } from "../src/yaml/index";
import { holdsGetPut } from "../src/lens";
import { type Json } from "../src/ops";

const SOURCE = `# Deployment config for acme-api
name: acme-api        # the service name
replicas: 3
resources:
  # tuned for production load
  cpu: "500m"
  memory: 512Mi
features:
  - logging
  - metrics
`;

describe("yamlLens", () => {
  it("projects the document as plain JSON", () => {
    // 512Mi is not a valid number, so YAML keeps it as the string "512Mi".
    expect(yamlLens().get(SOURCE)).toEqual({
      name: "acme-api",
      replicas: 3,
      resources: { cpu: "500m", memory: "512Mi" },
      features: ["logging", "metrics"],
    });
  });

  it("a no-op save returns the source byte-for-byte (no reformatting)", () => {
    const lens = yamlLens();
    const { model, ops } = lens.put(SOURCE, lens.get(SOURCE));
    expect(ops).toEqual([]);
    expect(model).toBe(SOURCE);
  });

  it("edits a nested value and keeps every comment", () => {
    const lens = yamlLens();
    const view = lens.get(SOURCE);
    (view.resources as { cpu: string }).cpu = "750m";

    const { model, ops } = lens.put(SOURCE, view);
    expect(ops).toEqual([
      { op: "replace", path: "/resources/cpu", value: "750m", prev: "500m" },
    ]);
    // comments survive
    expect(model).toContain("# Deployment config for acme-api");
    expect(model).toContain("# the service name");
    expect(model).toContain("# tuned for production load");
    // the edit landed
    expect(model).toContain('cpu: "750m"');
    // untouched keys are still there, in order
    expect(model.indexOf("name:")).toBeLessThan(model.indexOf("replicas:"));
  });

  it("appends to a sequence without disturbing its neighbours or comments", () => {
    const lens = yamlLens();
    const view = lens.get(SOURCE);
    (view.features as string[]).push("tracing");

    const { model, ops } = lens.put(SOURCE, view);
    expect(ops).toEqual([{ op: "add", path: "/features/2", value: "tracing" }]);
    expect(model).toContain("- logging");
    expect(model).toContain("- metrics");
    expect(model).toContain("- tracing");
    expect(model).toContain("# tuned for production load");
  });

  it("removes a key and preserves the rest", () => {
    const lens = yamlLens();
    const view = lens.get(SOURCE);
    delete view.replicas;

    const { model, ops } = lens.put(SOURCE, view);
    expect(ops).toEqual([{ op: "remove", path: "/replicas", prev: 3 }]);
    expect(model).not.toContain("replicas:");
    expect(model).toContain("name: acme-api");
    expect(model).toContain("# Deployment config for acme-api");
  });

  it("restricts edits to declared keys, preserving everything else verbatim", () => {
    const lens = yamlLens({ editable: ["replicas"] });
    expect(lens.get(SOURCE)).toEqual({ replicas: 3 });

    const { model } = lens.put(SOURCE, { replicas: 10 });
    expect(model).toContain("replicas: 10");
    // resources/features were never in the view, so they can't be dropped
    expect(model).toContain("cpu:");
    expect(model).toContain("- metrics");
  });

  it("law: GetPut — projecting and folding back is an exact no-op", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom("name", "replicas", "memory", "enabled"),
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
          ) as fc.Arbitrary<Json>,
          { minKeys: 1 },
        ),
        (data) => {
          const src =
            Object.entries(data)
              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
              .join("\n") + "\n";
          expect(holdsGetPut(yamlLens(), src)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

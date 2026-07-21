/**
 * Example: partially editing a package.json while preserving everything the
 * editor doesn't manage.
 *
 *   npm run build && node examples/package-json-editor.mjs
 * or, with tsx installed:
 *   npx tsx examples/package-json-editor.ts
 */
import { configLens } from "../src/index";

// A realistic document with plenty the "editor" was never taught about:
// scripts, a custom tool config, an unknown future field.
const pkg = {
  name: "acme-widget",
  version: "2.3.0",
  private: true,
  scripts: { build: "tsc", test: "vitest run" },
  "acme:telemetry": { endpoint: "https://t.acme.dev", sampleRate: 0.1 },
  futureField: ["reserved", "by", "a", "newer", "schema"],
};

// The editor is only allowed to touch name + version.
const lens = configLens(["name", "version"]);

const view = lens.get(pkg);
console.log("projected view:", view);
// → { name: 'acme-widget', version: '2.3.0' }

// The user bumps the version in the form.
view.version = "2.4.0";

const { model, ops } = lens.put(pkg, view);

console.log("\nminimal patch:", JSON.stringify(ops, null, 2));
// → [{ op: "replace", path: "/version", value: "2.4.0", prev: "2.3.0" }]

console.log("\nresulting document keeps everything else verbatim:");
console.log(JSON.stringify(model, null, 2));
// scripts, acme:telemetry and futureField are byte-for-byte untouched.

import { useMemo, useState } from "react";
import { yamlLens } from "reweave/yaml";
import { type Json } from "reweave";

const SAMPLE = `# Helm values for acme-api
# (edit the fields on the right — comments and layout are preserved)
name: acme-api
replicas: 3

image:
  repository: registry.acme.dev/api
  tag: "1.8.2"          # bump on release
  pullPolicy: IfNotPresent

resources:
  # sized for production traffic
  requests:
    cpu: "500m"
    memory: 512Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
`;

type Scalar = string | number | boolean;

function flatten(
  v: Json,
  path: (string | number)[] = [],
): { path: (string | number)[]; value: Scalar }[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => flatten(x, [...path, i]));
  if (v && typeof v === "object")
    return Object.entries(v).flatMap(([k, val]) => flatten(val, [...path, k]));
  return [{ path, value: v as Scalar }];
}

function setByPath(obj: Json, path: (string | number)[], value: Json): Json {
  if (path.length === 0) return value;
  const clone: Json = Array.isArray(obj)
    ? [...obj]
    : { ...(obj as { [k: string]: Json }) };
  const [head, ...rest] = path;
  const container = clone as { [k: string]: Json } & Json[];
  container[head as number] = setByPath(container[head as number], rest, value);
  return clone;
}

const lens = yamlLens();

export function YamlDemo() {
  const [baseline, setBaseline] = useState(SAMPLE);
  const [view, setView] = useState<{ [k: string]: Json }>(() =>
    lens.get(SAMPLE),
  );

  const { model, ops } = useMemo(
    () => lens.put(baseline, view),
    [baseline, view],
  );
  const leaves = useMemo(() => flatten(view), [view]);

  const load = (src: string) => {
    setBaseline(src);
    setView(lens.get(src));
  };

  const setLeaf = (path: (string | number)[], raw: string, orig: Scalar) => {
    let val: Scalar = raw;
    if (typeof orig === "number" && raw.trim() !== "" && !isNaN(Number(raw)))
      val = Number(raw);
    else if (typeof orig === "boolean") val = raw === "true";
    setView((cur) => setByPath(cur, path, val) as { [k: string]: Json });
  };

  return (
    <>
      <p className="hint yaml-intro">
        A comment-annotated Helm <code>values.yaml</code>. Edit the fields — the
        result keeps <strong>every comment</strong>, the key order, and the
        quoting, and you get a <strong>minimal patch</strong>. This is the
        adapter people feel: no more GUI mangling your YAML.
      </p>
      <div className="grid">
        <section className="panel">
          <h2>Fields (projected view)</h2>
          <div className="yaml-form">
            {leaves.map((leaf, i) => (
              <label key={i} className="yaml-field">
                <span className="yaml-key">{leaf.path.join(".")}</span>
                {typeof leaf.value === "boolean" ? (
                  <select
                    value={String(leaf.value)}
                    onChange={(e) => setLeaf(leaf.path, e.target.value, leaf.value)}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    value={String(leaf.value)}
                    spellCheck={false}
                    onChange={(e) => setLeaf(leaf.path, e.target.value, leaf.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <button className="save" onClick={() => load(SAMPLE)}>
            Reset sample
          </button>
        </section>

        <section className="panel">
          <h2>Resulting file</h2>
          <pre className="out yaml-out">{model}</pre>
          <h2>
            Minimal patch{" "}
            <span className="count">
              {ops.length} op{ops.length === 1 ? "" : "s"}
            </span>
          </h2>
          <pre className="out ops">
            {ops.length === 0 ? "// no changes — file returned untouched" : JSON.stringify(ops, null, 2)}
          </pre>
          <button
            className="save"
            disabled={ops.length === 0}
            onClick={() => load(model)}
          >
            Save (adopt result as baseline)
          </button>
        </section>
      </div>
      <details className="yaml-source">
        <summary>Show the baseline source</summary>
        <pre className="out">{baseline}</pre>
      </details>
    </>
  );
}

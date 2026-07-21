import { useMemo, useState } from "react";
import { exprLens, parse, serialize, type Expr } from "reweave";
import { type Path, mutate, newCondition } from "../tree";
import { TreeView, type EditFn } from "./TreeView";
import { TableView } from "./TableView";
import { GraphView } from "./GraphView";

const SAMPLES: { label: string; source: string }[] = [
  {
    label: "Targeting rule",
    source:
      'country in ["US", "CA"] AND plan == "pro" AND geo.near(hq, 50km) AND NOT tester == true',
  },
  {
    label: "With a vendor accessor",
    source:
      'risk.score(model_v2) > 0.8 OR (chargebacks >= 3 AND account_age_days < 30)',
  },
  {
    label: "Simple",
    source: 'email matches(/@acme\\.com$/) OR role == "admin"',
  },
];

type Tab = "tree" | "table" | "graph";
const TABS: { id: Tab; label: string }[] = [
  { id: "tree", label: "Tree" },
  { id: "table", label: "Table" },
  { id: "graph", label: "Graph" },
];

export function RuleDemo() {
  const [baseline, setBaseline] = useState(SAMPLES[0].source);
  const [ast, setAst] = useState<Expr>(() => parse(SAMPLES[0].source));
  const [draft, setDraft] = useState(SAMPLES[0].source);
  const [tab, setTab] = useState<Tab>("tree");

  const serialized = useMemo(() => serialize(ast), [ast]);
  const { ops } = useMemo(() => exprLens.put(baseline, ast), [baseline, ast]);

  const load = (source: string) => {
    setDraft(source);
    setBaseline(source);
    setAst(parse(source));
  };

  const edit: EditFn = (path: Path, fn: (n: Expr) => Expr | null) =>
    setAst((cur) => mutate(cur, path, fn));

  return (
    <>
      <p className="hint">
        One lens, three views — edit in any of them and get the same minimal
        patch, while <span className="raw-chip">raw</span> constructs the grammar
        can't model are kept verbatim.
      </p>

      <section className="loader">
        <div className="samples">
          {SAMPLES.map((s) => (
            <button key={s.label} onClick={() => load(s.source)}>
              {s.label}
            </button>
          ))}
        </div>
        <textarea
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="primary" onClick={() => load(draft)}>
          Load rule
        </button>
      </section>

      <div className="grid">
        <section className="panel">
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
            <span className="tabs-note">same model · same lens</span>
          </div>

          {tab === "tree" && <TreeView ast={ast} edit={edit} />}
          {tab === "table" && <TableView ast={ast} edit={edit} />}
          {tab === "graph" && <GraphView ast={ast} edit={edit} />}

          {tab === "tree" && (
            <div className="add-root">
              <button
                onClick={() =>
                  setAst((cur) => ({
                    type: "and",
                    nodes: [cur, newCondition()],
                  }))
                }
              >
                + AND a condition at the top
              </button>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Serialized model</h2>
          <pre className="out">{serialized}</pre>

          <h2>
            Minimal patch{" "}
            <span className="count">
              {ops.length} op{ops.length === 1 ? "" : "s"}
            </span>
          </h2>
          <p className="hint">Diff from the loaded baseline.</p>
          <pre className="out ops">
            {ops.length === 0 ? "// no changes" : JSON.stringify(ops, null, 2)}
          </pre>

          <button
            className="save"
            disabled={ops.length === 0}
            onClick={() => setBaseline(serialized)}
          >
            Save (adopt as new baseline)
          </button>
        </section>
      </div>
    </>
  );
}

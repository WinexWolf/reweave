import { useState } from "react";
import { RuleDemo } from "./views/RuleDemo";
import { YamlDemo } from "./views/YamlDemo";

type Mode = "rules" | "yaml";
const MODES: { id: Mode; label: string; sub: string }[] = [
  { id: "rules", label: "Targeting rules", sub: "expression lens · 3 views" },
  { id: "yaml", label: "YAML config", sub: "comment-preserving lens" },
];

export function App() {
  const [mode, setMode] = useState<Mode>("rules");

  return (
    <div className="app">
      <header>
        <h1>
          re<span>weave</span>
        </h1>
        <p>
          Lossless partial editing for structured documents. Edit a friendly
          projection, get a <strong>minimal patch</strong>, and keep everything
          the editor can't model — <strong>verbatim</strong>.
        </p>
      </header>

      <div className="modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode ${mode === m.id ? "active" : ""}`}
            onClick={() => setMode(m.id)}
          >
            <strong>{m.label}</strong>
            <span>{m.sub}</span>
          </button>
        ))}
      </div>

      {mode === "rules" ? <RuleDemo /> : <YamlDemo />}

      <footer>
        Same core everywhere: <code>get</code> projects an editable view,{" "}
        <code>put</code> folds edits back into the original model and returns the
        minimal diff. Untouched regions — raw expressions, YAML comments, unknown
        keys — are never parsed and never rewritten.
      </footer>
    </div>
  );
}

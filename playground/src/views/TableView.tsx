import { COMPARE_OPS, type CompareOp } from "reweave";
import {
  collectLeaves,
  literalToText,
  textToLiteral,
} from "../tree";
import { type EditFn } from "./TreeView";
import { type Expr } from "reweave";

/** A flat, spreadsheet-like view of every leaf regardless of nesting — the same
 *  model, projected completely differently from the tree. Edits round-trip
 *  identically; raw leaves stay read-only and preserved. */
export function TableView({ ast, edit }: { ast: Expr; edit: EditFn }) {
  const leaves = collectLeaves(ast);
  return (
    <div className="table">
      <div className="table-row table-head">
        <span>Context</span>
        <span>Field</span>
        <span>Op</span>
        <span>Value</span>
        <span />
      </div>
      {leaves.map((leaf, i) => {
        const ctx = leaf.context.join(" › ") || "—";
        if (leaf.node.type === "raw") {
          return (
            <div key={i} className="table-row raw-row">
              <span className="ctx">{ctx}</span>
              <span className="raw-cell" style={{ gridColumn: "2 / 5" }}>
                <span className="raw-chip">raw</span>
                <code>{leaf.node.source}</code>
              </span>
              <button
                className="del"
                onClick={() => edit(leaf.path, () => null)}
              >
                ×
              </button>
            </div>
          );
        }
        const cmp = leaf.node;
        return (
          <div key={i} className="table-row">
            <span className="ctx">{ctx}</span>
            <input
              className="field"
              value={cmp.field}
              spellCheck={false}
              onChange={(e) =>
                edit(leaf.path, (n) =>
                  n.type === "compare" ? { ...n, field: e.target.value } : n,
                )
              }
            />
            <select
              className="op"
              value={cmp.op}
              onChange={(e) =>
                edit(leaf.path, (n) =>
                  n.type === "compare"
                    ? { ...n, op: e.target.value as CompareOp }
                    : n,
                )
              }
            >
              {COMPARE_OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <input
              className="value"
              value={literalToText(cmp.value)}
              spellCheck={false}
              onChange={(e) =>
                edit(leaf.path, (n) =>
                  n.type === "compare"
                    ? { ...n, value: textToLiteral(e.target.value) }
                    : n,
                )
              }
            />
            <button className="del" onClick={() => edit(leaf.path, () => null)}>
              ×
            </button>
          </div>
        );
      })}
      {leaves.length === 0 && <p className="hint">No conditions.</p>}
    </div>
  );
}

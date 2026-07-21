import {
  COMPARE_OPS,
  type Expr,
  type CompareOp,
} from "reweave";
import {
  type Path,
  newCondition,
  literalToText,
  textToLiteral,
} from "../tree";

export type EditFn = (path: Path, fn: (n: Expr) => Expr | null) => void;

export function TreeView({ ast, edit }: { ast: Expr; edit: EditFn }) {
  return (
    <div className="tree">
      <NodeEditor node={ast} path={[]} edit={edit} />
    </div>
  );
}

function NodeEditor({
  node,
  path,
  edit,
}: {
  node: Expr;
  path: Path;
  edit: EditFn;
}) {
  switch (node.type) {
    case "compare":
      return <CompareEditor node={node} path={path} edit={edit} />;

    case "raw":
      return (
        <div className="node raw">
          <span className="raw-chip">raw</span>
          <code>{node.source}</code>
          <span className="verbatim">preserved verbatim</span>
          <button className="del" onClick={() => edit(path, () => null)}>
            ×
          </button>
        </div>
      );

    case "not":
      return (
        <div className="node not">
          <span className="kw">NOT</span>
          <NodeEditor node={node.node} path={[...path, "node"]} edit={edit} />
        </div>
      );

    case "and":
    case "or":
      return (
        <div className={`node group ${node.type}`}>
          <div className="group-head">
            <button
              className={`op-toggle ${node.type}`}
              onClick={() =>
                edit(path, (n) =>
                  n.type === "and" || n.type === "or"
                    ? { ...n, type: n.type === "and" ? "or" : "and" }
                    : n,
                )
              }
              title="Toggle AND / OR"
            >
              {node.type.toUpperCase()}
            </button>
            <button
              className="add"
              onClick={() =>
                edit(path, (n) =>
                  n.type === "and" || n.type === "or"
                    ? { ...n, nodes: [...n.nodes, newCondition()] }
                    : n,
                )
              }
            >
              + condition
            </button>
          </div>
          <div className="children">
            {node.nodes.map((child, i) => (
              <div key={i} className="child">
                {i > 0 && (
                  <div className={`connector ${node.type}`}>{node.type}</div>
                )}
                <NodeEditor node={child} path={[...path, i]} edit={edit} />
              </div>
            ))}
          </div>
        </div>
      );
  }
}

export function CompareEditor({
  node,
  path,
  edit,
}: {
  node: Extract<Expr, { type: "compare" }>;
  path: Path;
  edit: EditFn;
}) {
  return (
    <div className="node compare">
      <input
        className="field"
        value={node.field}
        spellCheck={false}
        onChange={(e) =>
          edit(path, (n) =>
            n.type === "compare" ? { ...n, field: e.target.value } : n,
          )
        }
      />
      <select
        className="op"
        value={node.op}
        onChange={(e) =>
          edit(path, (n) =>
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
        value={literalToText(node.value)}
        spellCheck={false}
        onChange={(e) =>
          edit(path, (n) =>
            n.type === "compare"
              ? { ...n, value: textToLiteral(e.target.value) }
              : n,
          )
        }
      />
      <button className="del" onClick={() => edit(path, () => null)}>
        ×
      </button>
    </div>
  );
}

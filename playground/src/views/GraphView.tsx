import { useMemo, useState } from "react";
import { type Expr } from "reweave";
import { type Path, collectLeaves } from "../tree";
import { CompareEditor, type EditFn } from "./TreeView";

type GNode = {
  expr: Expr;
  path: Path;
  x: number;
  y: number;
  children: GNode[];
};

const X_GAP = 170;
const Y_GAP = 92;
const NODE_W = 140;
const NODE_H = 40;
const PAD = 30;

function layout(root: Expr): { nodes: GNode[]; depth: number; leaves: number } {
  let leafX = 0;
  let maxDepth = 0;

  function build(expr: Expr, path: Path, depth: number): GNode {
    maxDepth = Math.max(maxDepth, depth);
    let childExprs: { expr: Expr; path: Path }[] = [];
    if (expr.type === "and" || expr.type === "or") {
      childExprs = expr.nodes.map((n, i) => ({ expr: n, path: [...path, i] }));
    } else if (expr.type === "not") {
      childExprs = [{ expr: expr.node, path: [...path, "node"] }];
    }

    if (childExprs.length === 0) {
      const node: GNode = { expr, path, x: leafX++, y: depth, children: [] };
      return node;
    }
    const children = childExprs.map((c) => build(c.expr, c.path, depth + 1));
    const x = (children[0].x + children[children.length - 1].x) / 2;
    return { expr, path, x, y: depth, children };
  }

  const tree = build(root, [], 0);
  const flat: GNode[] = [];
  (function walk(n: GNode) {
    flat.push(n);
    n.children.forEach(walk);
  })(tree);
  return { nodes: flat, depth: maxDepth, leaves: leafX };
}

function label(expr: Expr): string {
  switch (expr.type) {
    case "and":
      return "AND";
    case "or":
      return "OR";
    case "not":
      return "NOT";
    case "compare":
      return `${expr.field} ${expr.op} ${short(literal(expr.value))}`;
    case "raw":
      return short(expr.source, 20);
  }
}

function literal(v: unknown): string {
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  return typeof v === "string" ? `"${v}"` : String(v);
}

function short(s: string, n = 16): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function cx(n: GNode): number {
  return PAD + n.x * X_GAP + NODE_W / 2;
}
function cy(n: GNode): number {
  return PAD + n.y * Y_GAP + NODE_H / 2;
}

export function GraphView({ ast, edit }: { ast: Expr; edit: EditFn }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { nodes, depth, leaves } = useMemo(() => layout(ast), [ast]);

  const width = Math.max(leaves, 1) * X_GAP + PAD * 2;
  const height = (depth + 1) * Y_GAP + PAD * 2;

  const selNode = useMemo(() => {
    if (!selected) return null;
    return (
      collectLeaves(ast).find((l) => JSON.stringify(l.path) === selected) ?? null
    );
  }, [ast, selected]);

  const parentToChildren = nodes.flatMap((p) =>
    p.children.map((c) => ({ p, c })),
  );

  return (
    <div className="graph">
      <div className="graph-scroll">
        <svg width={width} height={height} role="img">
          {parentToChildren.map(({ p, c }, i) => {
            const x1 = cx(p);
            const y1 = cy(p) + NODE_H / 2;
            const x2 = cx(c);
            const y2 = cy(c) - NODE_H / 2;
            const mid = (y1 + y2) / 2;
            return (
              <path
                key={i}
                d={`M ${x1},${y1} C ${x1},${mid} ${x2},${mid} ${x2},${y2}`}
                className="edge"
              />
            );
          })}
          {nodes.map((n, i) => {
            const isSel = JSON.stringify(n.path) === selected;
            const onClick = () => {
              if (n.expr.type === "and" || n.expr.type === "or") {
                edit(n.path, (e) =>
                  e.type === "and" || e.type === "or"
                    ? { ...e, type: e.type === "and" ? "or" : "and" }
                    : e,
                );
              } else if (n.expr.type === "compare") {
                setSelected(JSON.stringify(n.path));
              }
            };
            return (
              <g
                key={i}
                transform={`translate(${PAD + n.x * X_GAP}, ${PAD + n.y * Y_GAP})`}
                className={`gnode ${n.expr.type} ${isSel ? "sel" : ""}`}
                onClick={onClick}
              >
                <rect width={NODE_W} height={NODE_H} rx={9} />
                <text x={NODE_W / 2} y={NODE_H / 2}>
                  {label(n.expr)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="hint">
        Click an <strong>AND/OR</strong> node to flip it; click a{" "}
        <strong>comparison</strong> to edit it below. <span className="raw-chip">raw</span>{" "}
        nodes are preserved and not editable.
      </p>

      {selNode && selNode.node.type === "compare" && (
        <div className="graph-editor">
          <span className="graph-editor-label">Editing selected node</span>
          <CompareEditor node={selNode.node} path={selNode.path} edit={edit} />
        </div>
      )}
    </div>
  );
}

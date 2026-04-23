import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

const DEFAULT_WIDTH = 520;
const DEFAULT_HEIGHT = 340;

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    g.setNode(node.id, {
      width: node.measured?.width ?? node.width ?? DEFAULT_WIDTH,
      height: node.measured?.height ?? node.height ?? DEFAULT_HEIGHT,
    });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const w = node.measured?.width ?? node.width ?? DEFAULT_WIDTH;
    const h = node.measured?.height ?? node.height ?? DEFAULT_HEIGHT;

    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - h / 2,
      },
    };
  });
}

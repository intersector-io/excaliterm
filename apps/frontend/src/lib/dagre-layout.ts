import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";

type NodeWithAnyData = Node<Record<string, unknown>>;

// Builds layout-only edges that encode the semantic hierarchy
// (host → terminal → command-history / screenshot / screen-share). DB edges
// are only consulted for screenshots, which lack a direct back-reference.
export function buildHierarchyEdges(nodes: Node[], dbEdges: Edge[]): Edge[] {
  const typed = nodes as NodeWithAnyData[];
  const terminalNodeByTerminalId = new Map<string, string>();
  const hostNodeByServiceInstanceId = new Map<string, string>();

  for (const n of typed) {
    if (n.type === "terminal") {
      const id = n.data.terminalId as string | undefined;
      if (id) terminalNodeByTerminalId.set(id, n.id);
    } else if (n.type === "host") {
      const sid = n.data.serviceInstanceId as string | undefined;
      if (sid) hostNodeByServiceInstanceId.set(sid, n.id);
    }
  }

  const nodeTypeById = new Map(typed.map((n) => [n.id, n.type] as const));
  const out: Edge[] = [];
  const pushed = new Set<string>();
  function push(source: string, target: string) {
    const id = `layout-${source}->${target}`;
    if (pushed.has(id)) return;
    pushed.add(id);
    out.push({ id, source, target });
  }

  for (const n of typed) {
    switch (n.type) {
      case "terminal":
      case "editor": {
        const sid = n.data.serviceInstanceId as string | null | undefined;
        const host = sid ? hostNodeByServiceInstanceId.get(sid) : undefined;
        if (host) push(host, n.id);
        break;
      }
      case "command-history": {
        const tid = n.data.terminalSessionId as string | undefined;
        const term = tid ? terminalNodeByTerminalId.get(tid) : undefined;
        if (term) push(term, n.id);
        break;
      }
      case "screen-share": {
        const src = n.data.sourceTerminalNodeId as string | undefined;
        if (src && nodeTypeById.get(src) === "terminal") push(src, n.id);
        break;
      }
      case "screenshot": {
        const parent = dbEdges.find(
          (e) => e.target === n.id && nodeTypeById.get(e.source) === "terminal",
        );
        if (parent) push(parent.source, n.id);
        break;
      }
    }
  }

  return out;
}

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

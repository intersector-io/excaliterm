type HostCandidateNode = {
  id: string;
  type?: string;
};

export function getHostNodeIds(nodes: HostCandidateNode[]): Set<string> {
  return new Set(
    nodes
      .filter((node) => node.type === "host")
      .map((node) => node.id),
  );
}

export function findNewHostNodeId(
  nodes: HostCandidateNode[],
  existingHostNodeIds: Set<string>,
): string | null {
  return (
    nodes.find(
      (node) => node.type === "host" && !existingHostNodeIds.has(node.id),
    )?.id ?? null
  );
}

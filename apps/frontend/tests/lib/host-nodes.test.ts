import { describe, it, expect } from "vitest";
import { findNewHostNodeId, getHostNodeIds } from "@/lib/host-nodes";

describe("host-nodes", () => {
  it("captures only host node ids for the connect flow baseline", () => {
    const nodes = [
      { id: "host-1", type: "host" },
      { id: "terminal-1", type: "terminal" },
      { id: "host-2", type: "host" },
    ];

    expect(getHostNodeIds(nodes)).toEqual(new Set(["host-1", "host-2"]));
  });

  it("finds the next host node that appeared after the baseline", () => {
    const nodes = [
      { id: "host-1", type: "host" },
      { id: "terminal-1", type: "terminal" },
      { id: "host-2", type: "host" },
    ];

    expect(findNewHostNodeId(nodes, new Set(["host-1"]))).toBe("host-2");
  });

  it("ignores non-host additions when waiting for a new host", () => {
    const nodes = [
      { id: "host-1", type: "host" },
      { id: "terminal-2", type: "terminal" },
    ];

    expect(findNewHostNodeId(nodes, new Set(["host-1"]))).toBeNull();
  });
});

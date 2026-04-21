import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { ReactFlowProvider } from "@xyflow/react";

const mockDeleteTerminal = vi.fn();
const mockDeleteNode = vi.fn();

vi.mock("@/hooks/use-terminal", () => ({
  useTerminals: () => ({
    deleteTerminal: mockDeleteTerminal,
    terminals: [],
    isLoading: false,
    createTerminal: vi.fn(),
    isCreating: false,
  }),
}));

vi.mock("@/hooks/use-canvas", () => ({
  useCanvas: () => ({
    deleteNode: mockDeleteNode,
    nodes: [],
    edges: [],
    onNodesChange: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@/hooks/use-terminal-collaboration", () => ({
  useTerminalCollaboration: () => ({
    lockInfo: null,
    activeTypers: [],
    lockedByCurrentCollaborator: false,
    lockedByOther: false,
    lockTerminal: vi.fn(),
    unlockTerminal: vi.fn(),
  }),
}));

vi.mock("@/components/terminal/TerminalView", () => ({
  TerminalView: ({ terminalId, status }: { terminalId: string; status: string }) =>
    createElement("div", {
      "data-testid": "terminal-view",
      "data-terminal-id": terminalId,
      "data-status": status,
    }),
}));

vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
  return {
    ...actual,
    NodeResizer: () => null,
  };
});

import { TerminalNode } from "@/components/canvas/TerminalNode";

function renderTerminalNode(overrides: {
  status?: "active" | "disconnected" | "exited" | "error";
  exitCode?: number | null;
  terminalId?: string;
}) {
  const props: any = {
    id: "node-1",
    data: {
      terminalId: overrides.terminalId ?? "abc12345-test-id",
      label: "Terminal",
      status: overrides.status ?? "active",
      exitCode: overrides.exitCode ?? null,
    },
    selected: false,
    type: "terminal" as const,
    dragging: false,
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
  };

  return render(
    createElement(
      ReactFlowProvider,
      null,
      createElement(TerminalNode, props),
    ),
  );
}

describe("TerminalNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteTerminal.mockResolvedValue(undefined);
    mockDeleteNode.mockResolvedValue(undefined);
  });

  it("renders an active terminal", () => {
    renderTerminalNode({ status: "active", terminalId: "abc12345-xxxx" });

    expect(screen.getByText("abc12345")).toBeInTheDocument();
    expect(screen.getByText("Live terminal")).toBeInTheDocument();
    expect(screen.getByTestId("terminal-view").dataset.status).toBe("active");
    expect(screen.queryByText("disconnected")).not.toBeInTheDocument();
  });

  it("renders disconnected terminals as inactive", () => {
    const { container } = renderTerminalNode({ status: "disconnected" });

    expect(screen.getAllByText("Host offline").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("terminal-view").dataset.status).toBe("disconnected");
    expect(container.querySelector(".opacity-70")).not.toBeNull();
  });

  it("close button destroys active terminals before removing the node", async () => {
    renderTerminalNode({ status: "active" });

    fireEvent.click(screen.getByTitle("Close terminal"));

    await waitFor(() => {
      expect(mockDeleteTerminal).toHaveBeenCalledWith("abc12345-test-id");
      expect(mockDeleteNode).toHaveBeenCalledWith("node-1");
    });
  });

  it("close button only dismisses disconnected terminals", async () => {
    renderTerminalNode({ status: "disconnected" });

    fireEvent.click(screen.getByTitle("Dismiss"));

    await waitFor(() => {
      expect(mockDeleteTerminal).not.toHaveBeenCalled();
      expect(mockDeleteNode).toHaveBeenCalledWith("node-1");
    });
  });

  it("shows the error badge for error terminals", () => {
    renderTerminalNode({ status: "error" });

    expect(screen.getAllByText("Needs attention").length).toBeGreaterThanOrEqual(1);
  });
});

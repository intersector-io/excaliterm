import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { ReactFlowProvider } from "@xyflow/react";

const mockDeleteTerminal = vi.fn();
const mockDeleteNode = vi.fn();
const mockUpdateTerminal = vi.fn();
const mockAddScreenShareNode = vi.fn();

vi.mock("@/hooks/use-terminal", () => ({
  useTerminals: () => ({
    deleteTerminal: mockDeleteTerminal,
    updateTerminal: mockUpdateTerminal,
    terminals: [],
    isLoading: false,
    createTerminal: vi.fn(),
    isCreating: false,
  }),
}));

vi.mock("@/hooks/use-canvas", () => ({
  useCanvas: () => ({
    deleteNode: mockDeleteNode,
    addScreenShareNode: mockAddScreenShareNode,
    nodes: [],
    edges: [],
    onNodesChange: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));

vi.mock("@/hooks/use-screenshot", () => ({
  useScreenshot: () => ({
    monitors: [],
    isLoadingMonitors: false,
    isCapturing: false,
    listMonitors: vi.fn(),
    captureScreenshot: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-screen-share", () => ({
  useScreenShare: () => ({
    isSharing: false,
    startScreenShare: vi.fn(),
    stopSharing: vi.fn(),
  }),
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
  selected?: boolean;
}) {
  const props: any = {
    id: "node-1",
    data: {
      terminalId: overrides.terminalId ?? "abc12345-test-id",
      label: "Terminal",
      status: overrides.status ?? "active",
      exitCode: overrides.exitCode ?? null,
    },
    selected: overrides.selected ?? false,
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
    mockUpdateTerminal.mockResolvedValue(undefined);
  });

  it("renders an active terminal", () => {
    renderTerminalNode({ status: "active", terminalId: "abc12345-xxxx" });

    expect(screen.getByText("abc12345")).toBeInTheDocument();
    expect(screen.getAllByText("Live").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("terminal-view").dataset.status).toBe("active");
  });

  it("renders disconnected terminals as inactive", () => {
    const { container } = renderTerminalNode({ status: "disconnected" });

    expect(screen.getAllByText("Offline").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("terminal-view").dataset.status).toBe("disconnected");
    expect(container.querySelector(".opacity-70")).not.toBeNull();
  });

  it("shows overflow menu trigger when selected for active terminals", () => {
    renderTerminalNode({ status: "active", selected: true });

    const menuTrigger = screen.getByRole("button", { expanded: false });
    expect(menuTrigger).toBeInTheDocument();
  });

  it("shows overflow menu trigger when selected for disconnected terminals", () => {
    renderTerminalNode({ status: "disconnected", selected: true });

    const menuTrigger = screen.getByRole("button", { expanded: false });
    expect(menuTrigger).toBeInTheDocument();
  });

  it("shows error status for error terminals", () => {
    renderTerminalNode({ status: "error" });

    expect(screen.getAllByText("Error").length).toBeGreaterThanOrEqual(1);
  });
});

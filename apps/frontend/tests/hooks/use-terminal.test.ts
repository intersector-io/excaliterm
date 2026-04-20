import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useTerminals } from "@/hooks/use-terminal";
import { useTerminalStore } from "@/stores/terminal-store";

const hubHandlers = new Map<string, Set<Function>>();
const mockTerminalHub = {
  on: vi.fn((event: string, handler: Function) => {
    if (!hubHandlers.has(event)) hubHandlers.set(event, new Set());
    hubHandlers.get(event)?.add(handler);
  }),
  off: vi.fn((event: string, handler: Function) => {
    hubHandlers.get(event)?.delete(handler);
  }),
  invoke: vi.fn().mockResolvedValue(undefined),
  state: "Connected",
};

vi.mock("@/lib/signalr-client", () => ({
  getTerminalHub: () => mockTerminalHub,
}));

vi.mock("@/hooks/use-workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1" }),
}));

vi.mock("@/lib/api-client", () => ({
  listTerminals: vi.fn(),
  createTerminal: vi.fn(),
  deleteTerminal: vi.fn(),
}));

import * as api from "@/lib/api-client";

const mockedApi = vi.mocked(api);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useTerminals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hubHandlers.clear();
    useTerminalStore.setState({ buffers: new Map() });
  });

  it("lists terminals via API", async () => {
    const terminals = [
      {
        id: "t1",
        status: "active",
        exitCode: null,
        createdAt: "2026-04-19T00:00:00.000Z",
        updatedAt: "2026-04-19T00:00:00.000Z",
      },
      {
        id: "t2",
        status: "exited",
        exitCode: 0,
        createdAt: "2026-04-19T00:00:00.000Z",
        updatedAt: "2026-04-19T00:00:00.000Z",
      },
    ] as const;
    mockedApi.listTerminals.mockResolvedValue({ terminals });

    const { result } = renderHook(() => useTerminals(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.terminals).toEqual(terminals);
    expect(mockedApi.listTerminals).toHaveBeenCalledWith("ws-1");
  });

  it("creates a terminal via API", async () => {
    mockedApi.listTerminals.mockResolvedValue({ terminals: [] });
    mockedApi.createTerminal.mockResolvedValue({
      terminal: {
        id: "new-t",
        status: "active",
        exitCode: null,
        createdAt: "2026-04-19T00:00:00.000Z",
        updatedAt: "2026-04-19T00:00:00.000Z",
      },
      canvasNode: {
        id: "node-1",
        terminalSessionId: "new-t",
        nodeType: "terminal",
        noteId: null,
        x: 100,
        y: 100,
        width: 600,
        height: 400,
        zIndex: 0,
        createdAt: "2026-04-19T00:00:00.000Z",
        updatedAt: "2026-04-19T00:00:00.000Z",
      },
    });

    const { result } = renderHook(() => useTerminals(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.createTerminal({});
    });

    expect(mockedApi.createTerminal).toHaveBeenCalledWith("ws-1", {});
  });

  it("deletes a terminal via API", async () => {
    mockedApi.listTerminals.mockResolvedValue({
      terminals: [
        {
          id: "t1",
          status: "active",
          exitCode: null,
          createdAt: "2026-04-19T00:00:00.000Z",
          updatedAt: "2026-04-19T00:00:00.000Z",
        },
      ],
    });
    mockedApi.deleteTerminal.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminals(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.deleteTerminal("t1");
    });

    expect(mockedApi.deleteTerminal).toHaveBeenCalledWith("ws-1", "t1");
  });

  it("SignalR output events add data to the store", async () => {
    mockedApi.listTerminals.mockResolvedValue({ terminals: [] });

    renderHook(() => useTerminals(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(hubHandlers.has("TerminalOutput")).toBe(true);
    });

    act(() => {
      hubHandlers.get("TerminalOutput")?.forEach((handler) =>
        handler({ terminalId: "t1", data: "hello from signalr" }),
      );
    });

    const stored = useTerminalStore.getState().getOutput("t1");
    expect(stored).toEqual(["hello from signalr"]);
  });

  it("marks a terminal disconnected when the host drops", async () => {
    mockedApi.listTerminals.mockResolvedValue({
      terminals: [
        {
          id: "t1",
          status: "active",
          exitCode: null,
          createdAt: "2026-04-19T00:00:00.000Z",
          updatedAt: "2026-04-19T00:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useTerminals(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.terminals[0]?.status).toBe("active");
    });

    act(() => {
      hubHandlers.get("TerminalDisconnected")?.forEach((handler) =>
        handler({ terminalId: "t1" }),
      );
    });

    await waitFor(() => {
      expect(result.current.terminals[0]?.status).toBe("disconnected");
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useServices } from "@/hooks/use-services";

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
  listServices: vi.fn(),
  deleteServiceApi: vi.fn(),
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

const ONLINE_SERVICE = {
  id: "svc-db-1",
  serviceId: "svc-public-1",
  name: "Host 1",
  whitelistedPaths: null,
  status: "online" as const,
  lastSeen: "2026-04-23T00:00:00.000Z",
  createdAt: "2026-04-23T00:00:00.000Z",
  updatedAt: "2026-04-23T00:00:00.000Z",
};

describe("useServices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hubHandlers.clear();
  });

  it("marks an existing service online without refetching", async () => {
    mockedApi.listServices.mockResolvedValue({
      services: [{ ...ONLINE_SERVICE, status: "offline", lastSeen: null }],
    });

    const { result } = renderHook(() => useServices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.onlineCount).toBe(0);
    });

    act(() => {
      hubHandlers.get("ServiceOnline")?.forEach((handler) =>
        handler(ONLINE_SERVICE.serviceId),
      );
    });

    await waitFor(() => {
      expect(result.current.onlineCount).toBe(1);
    });

    expect(mockedApi.listServices).toHaveBeenCalledTimes(1);
  });

  it("refetches services when a brand new host connects", async () => {
    mockedApi.listServices
      .mockResolvedValueOnce({ services: [] })
      .mockResolvedValueOnce({ services: [ONLINE_SERVICE] });

    const { result } = renderHook(() => useServices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.onlineCount).toBe(0);
    });

    act(() => {
      hubHandlers.get("ServiceOnline")?.forEach((handler) =>
        handler(ONLINE_SERVICE.serviceId),
      );
    });

    await waitFor(() => {
      expect(result.current.onlineCount).toBe(1);
    });

    expect(result.current.services).toEqual([ONLINE_SERVICE]);
    expect(mockedApi.listServices).toHaveBeenCalledTimes(2);
  });
});

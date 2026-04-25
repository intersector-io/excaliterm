import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import * as api from "@/lib/api-client";

// Module-level dedupe so the N component instances of useTerminals don't
// each log the same hub error event, and don't each fire an auto-dismiss.
const loggedErrors = new Set<string>();
const autoDismissed = new Set<string>();

function logTerminalErrorOnce(terminalId: string, error: string) {
  const key = `${terminalId}:${error}`;
  if (loggedErrors.has(key)) return;
  loggedErrors.add(key);
  console.warn(`Terminal ${terminalId} error: ${error}`);
}

function shouldAutoDismiss(error: string): boolean {
  return error === "Access denied";
}

function markAutoDismissed(terminalId: string): boolean {
  if (autoDismissed.has(terminalId)) return false;
  autoDismissed.add(terminalId);
  return true;
}
import { getTerminalHub } from "@/lib/signalr-client";
import { useTerminalStore } from "@/stores/terminal-store";
import { useWorkspace } from "@/hooks/use-workspace";
import type {
  CreateTerminalRequest,
  ListTerminalsResponse,
  TerminalStatus,
} from "@excaliterm/shared-types";

export function useTerminals() {
  const queryClient = useQueryClient();
  const addOutput = useTerminalStore((s) => s.addOutput);
  const { workspaceId } = useWorkspace();

  const terminalsQuery = useQuery({
    queryKey: ["terminals", workspaceId],
    queryFn: () => api.listTerminals(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateTerminalRequest) => api.createTerminal(workspaceId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTerminal(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    },
  });

  const dismissMutation = useMutation({
    // A 404 on dismiss means the terminal is already gone — treat as success
    // and refresh caches so the stale node clears from the UI.
    mutationFn: async (id: string) => {
      try {
        await api.dismissTerminal(workspaceId, id);
      } catch (err) {
        if (!(err instanceof Error && /API 404/.test(err.message))) throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { tags?: string[] } }) =>
      api.updateTerminal(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
    },
  });

  const closeAllMutation = useMutation({
    mutationFn: () => api.closeAllTerminals(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["notes", workspaceId] });
    },
  });

  const updateTerminalStatus = useCallback(
    (
      terminalId: string,
      status: TerminalStatus,
      exitCode: number | null = null,
    ) => {
      queryClient.setQueryData(
        ["terminals", workspaceId],
        (old: ListTerminalsResponse | undefined) => {
          if (!old) return old;
          const existing = old.terminals.find((t) => t.id === terminalId);
          if (existing?.status === status) return old;
          return {
            terminals: old.terminals.map((terminal) =>
              terminal.id === terminalId
                ? {
                    ...terminal,
                    status,
                    exitCode,
                    updatedAt: new Date().toISOString(),
                  }
                : terminal,
            ),
          };
        },
      );
    },
    [queryClient, workspaceId],
  );

  const handleOutput = useCallback(
    (msg: { terminalId: string; data: string }) => {
      addOutput(msg.terminalId, msg.data);
    },
    [addOutput],
  );

  const handleCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });
  }, [queryClient, workspaceId]);

  const handleExited = useCallback(
    (msg: { terminalId: string; exitCode: number }) => {
      updateTerminalStatus(msg.terminalId, "exited", msg.exitCode);
    },
    [updateTerminalStatus],
  );

  const handleDisconnected = useCallback(
    (msg: { terminalId: string }) => {
      updateTerminalStatus(msg.terminalId, "disconnected");
    },
    [updateTerminalStatus],
  );

  const handleError = useCallback(
    (msg: { terminalId: string; error: string }) => {
      logTerminalErrorOnce(msg.terminalId, msg.error);
      updateTerminalStatus(msg.terminalId, "error");

      // Orphan terminals (DB row exists but no agent owns the PTY) keep
      // emitting "Access denied" on every hub call. Drop them automatically.
      if (shouldAutoDismiss(msg.error) && markAutoDismissed(msg.terminalId)) {
        dismissMutation.mutate(msg.terminalId);
      }
    },
    [updateTerminalStatus, dismissMutation],
  );

  useEffect(() => {
    const terminalHub = getTerminalHub();

    terminalHub.on("TerminalOutput", handleOutput);
    terminalHub.on("TerminalCreated", handleCreated);
    terminalHub.on("TerminalExited", handleExited);
    terminalHub.on("TerminalDisconnected", handleDisconnected);
    terminalHub.on("TerminalError", handleError);

    return () => {
      terminalHub.off("TerminalOutput", handleOutput);
      terminalHub.off("TerminalCreated", handleCreated);
      terminalHub.off("TerminalExited", handleExited);
      terminalHub.off("TerminalDisconnected", handleDisconnected);
      terminalHub.off("TerminalError", handleError);
    };
  }, [handleOutput, handleCreated, handleExited, handleDisconnected, handleError]);

  return {
    terminals: terminalsQuery.data?.terminals ?? [],
    isLoading: terminalsQuery.isLoading,
    createTerminal: createMutation.mutateAsync,
    updateTerminal: updateMutation.mutateAsync,
    deleteTerminal: deleteMutation.mutateAsync,
    dismissTerminal: dismissMutation.mutateAsync,
    closeAllTerminals: closeAllMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isClosingAll: closeAllMutation.isPending,
  };
}

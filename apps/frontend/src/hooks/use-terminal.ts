import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import * as api from "@/lib/api-client";
import { getTerminalHub } from "@/lib/signalr-client";
import { useTerminalStore } from "@/stores/terminal-store";
import { useWorkspace } from "@/hooks/use-workspace";
import type {
  CreateTerminalRequest,
  ListTerminalsResponse,
  TerminalStatus,
} from "@terminal-proxy/shared-types";

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
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTerminal(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    },
  });

  useEffect(() => {
    const terminalHub = getTerminalHub();

    function updateTerminalStatus(
      terminalId: string,
      status: TerminalStatus,
      exitCode: number | null = null,
    ) {
      queryClient.setQueryData(
        ["terminals", workspaceId],
        (old: ListTerminalsResponse | undefined) => {
          if (!old) return old;
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
    }

    function handleOutput(msg: { terminalId: string; data: string }) {
      addOutput(msg.terminalId, msg.data);
    }

    function handleCreated() {
      queryClient.invalidateQueries({ queryKey: ["terminals", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    }

    function handleExited(msg: { terminalId: string; exitCode: number }) {
      updateTerminalStatus(msg.terminalId, "exited", msg.exitCode);
    }

    function handleDisconnected(msg: { terminalId: string }) {
      updateTerminalStatus(msg.terminalId, "disconnected");
    }

    function handleError(msg: { terminalId: string; error: string }) {
      console.error(`Terminal ${msg.terminalId} error: ${msg.error}`);
    }

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
  }, [addOutput, queryClient, workspaceId]);

  return {
    terminals: terminalsQuery.data?.terminals ?? [],
    isLoading: terminalsQuery.isLoading,
    createTerminal: createMutation.mutateAsync,
    deleteTerminal: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}

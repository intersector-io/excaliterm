import { useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-workspace";
import type { CommandHistory, CommandHistoryTopEntry } from "@excaliterm/shared-types";

export function useCommandHistorySave(terminalSessionId: string | null) {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const lastSavedRef = useRef<{ command: string; time: number }>({ command: "", time: 0 });

  const saveMutation = useMutation({
    mutationFn: (command: string) =>
      api.saveCommand(workspaceId, { terminalSessionId: terminalSessionId!, command }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["command-history", workspaceId, terminalSessionId] });
      queryClient.invalidateQueries({ queryKey: ["command-history-top", workspaceId, terminalSessionId] });
    },
  });

  const createNodeMutation = useMutation({
    mutationFn: (data: { sourceTerminalNodeId: string; x?: number; y?: number }) =>
      api.createCommandHistoryNode(workspaceId, {
        terminalSessionId: terminalSessionId!,
        ...data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });
    },
  });

  const saveCommand = useCallback(
    (command: string) => {
      if (!terminalSessionId) return;
      const now = Date.now();
      if (lastSavedRef.current.command === command && now - lastSavedRef.current.time < 2000) {
        return;
      }
      lastSavedRef.current = { command, time: now };
      saveMutation.mutate(command);
    },
    [terminalSessionId, saveMutation],
  );

  return {
    saveCommand,
    createNode: createNodeMutation.mutateAsync,
  };
}

export function useCommandHistoryQueries(terminalSessionId: string | null) {
  const { workspaceId } = useWorkspace();

  const historyQuery = useQuery({
    queryKey: ["command-history", workspaceId, terminalSessionId],
    queryFn: () => api.listCommandHistory(workspaceId, terminalSessionId!),
    enabled: !!terminalSessionId,
  });

  const topQuery = useQuery({
    queryKey: ["command-history-top", workspaceId, terminalSessionId],
    queryFn: () => api.listTopCommands(workspaceId, terminalSessionId!),
    enabled: !!terminalSessionId,
  });

  return {
    commands: (historyQuery.data?.commands ?? []) as CommandHistory[],
    topCommands: (topQuery.data?.commands ?? []) as CommandHistoryTopEntry[],
    isLoading: historyQuery.isLoading,
  };
}

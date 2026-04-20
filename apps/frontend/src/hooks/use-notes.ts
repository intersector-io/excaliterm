import { useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-workspace";

export interface NoteData {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function useNotes() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const notesQuery = useQuery({
    queryKey: ["notes", workspaceId],
    queryFn: () => api.listNotes(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: (req: { content?: string; x?: number; y?: number }) =>
      api.createNote(workspaceId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.updateNote(workspaceId, id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", workspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteNote(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    },
  });

  const debouncedUpdate = useCallback(
    (id: string, content: string) => {
      const existing = debounceTimers.current.get(id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        debounceTimers.current.delete(id);
        updateMutation.mutate({ id, content });
      }, 500);

      debounceTimers.current.set(id, timer);
    },
    [updateMutation],
  );

  return {
    notes: (notesQuery.data?.notes ?? []) as NoteData[],
    isLoading: notesQuery.isLoading,
    createNote: createMutation.mutateAsync,
    updateNote: debouncedUpdate,
    deleteNote: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}

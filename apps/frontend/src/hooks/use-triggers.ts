import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-workspace";
import { getCanvasHub } from "@/lib/signalr-client";
import type {
  CreateTriggerRequest,
  UpdateTriggerRequest,
  Trigger,
  TriggerFiredEvent,
} from "@excaliterm/shared-types";

export type { TriggerFiredEvent };

const fireListeners = new Set<(e: TriggerFiredEvent) => void>();
let hubSubscribed = false;

export function onTriggerFired(handler: (e: TriggerFiredEvent) => void): () => void {
  fireListeners.add(handler);
  return () => {
    fireListeners.delete(handler);
  };
}

export function useTriggers() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const triggersQuery = useQuery({
    queryKey: ["triggers", workspaceId],
    queryFn: () => api.listTriggers(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateTriggerRequest) => api.createTrigger(workspaceId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTriggerRequest }) =>
      api.updateTrigger(workspaceId, id, data),
    onSuccess: (res) => {
      queryClient.setQueryData(
        ["triggers", workspaceId],
        (old: { triggers: Trigger[] } | undefined) => {
          if (!old) return old;
          return {
            triggers: old.triggers.map((t) => (t.id === res.trigger.id ? res.trigger : t)),
          };
        },
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTrigger(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triggers", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });
    },
  });

  const fireMutation = useMutation({
    mutationFn: (id: string) => api.fireTrigger(workspaceId, id),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => api.rotateTriggerSecret(workspaceId, id),
    onSuccess: (res) => {
      queryClient.setQueryData(
        ["triggers", workspaceId],
        (old: { triggers: Trigger[] } | undefined) => {
          if (!old) return old;
          return {
            triggers: old.triggers.map((t) => (t.id === res.trigger.id ? res.trigger : t)),
          };
        },
      );
    },
  });

  useEffect(() => {
    if (hubSubscribed) return;
    hubSubscribed = true;
    const hub = getCanvasHub();
    function handle(evt: TriggerFiredEvent) {
      queryClient.setQueryData(
        ["triggers", workspaceId],
        (old: { triggers: Trigger[] } | undefined) => {
          if (!old) return old;
          let changed = false;
          const next = old.triggers.map((t) => {
            if (t.id !== evt.triggerId) return t;
            changed = true;
            return {
              ...t,
              lastFiredAt: new Date(evt.firedAt).toISOString(),
              lastError: evt.ok ? null : (evt.error ?? null),
            };
          });
          return changed ? { triggers: next } : old;
        },
      );
      for (const fn of fireListeners) fn(evt);
    }
    hub.on("TriggerFired", handle);
    return () => {
      hub.off("TriggerFired", handle);
      hubSubscribed = false;
    };
  }, [queryClient, workspaceId]);

  return {
    triggers: triggersQuery.data?.triggers ?? [],
    isLoading: triggersQuery.isLoading,
    createTrigger: createMutation.mutateAsync,
    updateTrigger: updateMutation.mutateAsync,
    deleteTrigger: deleteMutation.mutateAsync,
    fireTrigger: (id: string) =>
      fireMutation.mutateAsync(id).catch(() => {
        toast.error("Failed to fire trigger");
      }),
    rotateTrigger: (id: string) =>
      rotateMutation.mutateAsync(id).catch(() => {
        toast.error("Failed to rotate secret");
      }),
  };
}

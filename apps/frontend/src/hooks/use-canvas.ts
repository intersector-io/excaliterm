import { useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type Node,
  type Edge,
  type NodeChange,
  applyNodeChanges,
} from "@xyflow/react";
import * as api from "@/lib/api-client";
import { getCanvasHub } from "@/lib/signalr-client";
import { useWorkspace } from "@/hooks/use-workspace";
import type {
  CanvasNode,
  TerminalSession,
  TerminalStatus,
} from "@excaliterm/shared-types";
import type { NoteData } from "@/hooks/use-notes";

export interface TerminalNodeData {
  terminalId: string;
  label: string;
  tags: string[];
  status: TerminalStatus;
  exitCode: number | null;
  [key: string]: unknown;
}

export interface NoteNodeData {
  noteId: string;
  content: string;
  label: string;
  [key: string]: unknown;
}

type AnyNodeData = TerminalNodeData | NoteNodeData;

function canvasNodeToFlowNode(
  cn: CanvasNode,
  terminals: TerminalSession[],
  notes: NoteData[],
): Node<AnyNodeData> {
  if (cn.nodeType === "note" && cn.noteId) {
    const note = notes.find((n) => n.id === cn.noteId);
    return {
      id: cn.id,
      type: "note",
      position: { x: cn.x, y: cn.y },
      dragHandle: ".drag-handle",
      data: {
        noteId: cn.noteId,
        content: note?.content ?? "",
        label: "Note",
      },
      style: {
        width: cn.width,
        height: cn.height,
      },
      measured: { width: cn.width, height: cn.height },
      zIndex: cn.zIndex,
    };
  }

  const terminal = terminals.find((t) => t.id === cn.terminalSessionId);
  return {
    id: cn.id,
    type: "terminal",
    position: { x: cn.x, y: cn.y },
    dragHandle: ".drag-handle",
    data: {
      terminalId: cn.terminalSessionId ?? cn.id,
      label: "Terminal",
      tags: terminal?.tags ?? [],
      status: terminal?.status ?? "active",
      exitCode: terminal?.exitCode ?? null,
    },
    style: {
      width: cn.width,
      height: cn.height,
    },
    measured: { width: cn.width, height: cn.height },
    zIndex: cn.zIndex,
  };
}

export function useCanvas() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const nodesQuery = useQuery({
    queryKey: ["canvas-nodes", workspaceId],
    queryFn: () => api.listCanvasNodes(workspaceId),
  });

  const terminalsQuery = useQuery({
    queryKey: ["terminals", workspaceId],
    queryFn: () => api.listTerminals(workspaceId),
  });

  const notesQuery = useQuery({
    queryKey: ["notes", workspaceId],
    queryFn: () => api.listNotes(workspaceId),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateCanvasNode>[2] }) =>
      api.updateCanvasNode(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCanvasNode(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    },
  });

  const terminals = terminalsQuery.data?.terminals ?? [];
  const notes = (notesQuery.data?.notes ?? []) as NoteData[];

  useEffect(() => {
    const canvasHub = getCanvasHub();

    function handleNodeAdded() {
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
    }

    function handleNodeMoved(event: { nodeId: string; x: number; y: number }) {
      queryClient.setQueryData(
        ["canvas-nodes", workspaceId],
        (old: { nodes: CanvasNode[] } | undefined) => {
          if (!old) return old;
          return {
            nodes: old.nodes.map((cn) =>
              cn.id === event.nodeId ? { ...cn, x: event.x, y: event.y } : cn,
            ),
          };
        },
      );
    }

    function handleNodeResized(event: { nodeId: string; width: number; height: number }) {
      queryClient.setQueryData(
        ["canvas-nodes", workspaceId],
        (old: { nodes: CanvasNode[] } | undefined) => {
          if (!old) return old;
          return {
            nodes: old.nodes.map((cn) =>
              cn.id === event.nodeId
                ? { ...cn, width: event.width, height: event.height }
                : cn,
            ),
          };
        },
      );
    }

    function handleNodeRemoved(event: { nodeId: string }) {
      queryClient.setQueryData(
        ["canvas-nodes", workspaceId],
        (old: { nodes: CanvasNode[] } | undefined) => {
          if (!old) return old;
          return {
            nodes: old.nodes.filter((cn) => cn.id !== event.nodeId),
          };
        },
      );
    }

    canvasHub.on("NodeAdded", handleNodeAdded);
    canvasHub.on("NodeMoved", handleNodeMoved);
    canvasHub.on("NodeResized", handleNodeResized);
    canvasHub.on("NodeRemoved", handleNodeRemoved);

    return () => {
      canvasHub.off("NodeAdded", handleNodeAdded);
      canvasHub.off("NodeMoved", handleNodeMoved);
      canvasHub.off("NodeResized", handleNodeResized);
      canvasHub.off("NodeRemoved", handleNodeRemoved);
    };
  }, [queryClient, workspaceId]);

  const nodes: Node<AnyNodeData>[] = useMemo(
    () => (nodesQuery.data?.nodes ?? []).map((cn) => canvasNodeToFlowNode(cn, terminals, notes)),
    [nodesQuery.data, terminals, notes],
  );

  const edges: Edge[] = useMemo(() => [], []);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<AnyNodeData>>[]) => {
      queryClient.setQueryData(
        ["canvas-nodes", workspaceId],
        (old: { nodes: CanvasNode[] } | undefined) => {
          if (!old) return old;

          const flowNodes = old.nodes.map((cn) => canvasNodeToFlowNode(cn, terminals, notes));
          const updated = applyNodeChanges(changes, flowNodes);

          const canvasHub = getCanvasHub();

          for (const change of changes) {
            if (change.type === "position" && change.position && !change.dragging) {
              updateMutation.mutate({
                id: change.id,
                data: { x: change.position.x, y: change.position.y },
              });
              canvasHub.invoke("NodeMoved", change.id, change.position.x, change.position.y).catch(() => {});
            }
            if (change.type === "dimensions" && change.dimensions) {
              updateMutation.mutate({
                id: change.id,
                data: {
                  width: change.dimensions.width,
                  height: change.dimensions.height,
                },
              });
              canvasHub.invoke("NodeResized", change.id, change.dimensions.width, change.dimensions.height).catch(() => {});
            }
          }

          return {
            nodes: old.nodes.map((cn) => {
              const flowNode = updated.find((n) => n.id === cn.id);
              if (!flowNode) return cn;
              return {
                ...cn,
                x: flowNode.position.x,
                y: flowNode.position.y,
                width: flowNode.measured?.width ?? cn.width,
                height: flowNode.measured?.height ?? cn.height,
              };
            }),
          };
        },
      );
    },
    [queryClient, updateMutation, workspaceId],
  );

  return {
    nodes,
    edges,
    onNodesChange,
    deleteNode: deleteMutation.mutateAsync,
    isLoading: nodesQuery.isLoading,
  };
}

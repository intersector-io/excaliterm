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
  Screenshot,
  TerminalSession,
  TerminalStatus,
  CreateEditorNodeRequest,
} from "@excaliterm/shared-types";
import type { ServiceInstance } from "@/lib/api-client";
import type { NoteData } from "@/hooks/use-notes";
import { useScreenShareStore } from "@/stores/screen-share-store";

export interface TerminalNodeData {
  terminalId: string;
  serviceId: string | null;
  serviceInstanceId: string | null;
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

export interface ScreenshotNodeData {
  screenshotId: string;
  imageData: string;
  monitorIndex: number;
  width: number;
  height: number;
  capturedAt: string;
  label: string;
  [key: string]: unknown;
}

export interface ScreenShareNodeData {
  sessionId: string;
  serviceId: string;
  monitorIndex: number;
  monitorName: string;
  monitorWidth: number;
  monitorHeight: number;
  sourceTerminalNodeId?: string;
  label: string;
  [key: string]: unknown;
}

export interface HostNodeData {
  serviceInstanceId: string;
  serviceId: string;
  serviceName: string;
  label: string;
  [key: string]: unknown;
}

export interface EditorNodeData {
  serviceInstanceId: string;
  serviceId: string;
  serviceName: string;
  label: string;
  [key: string]: unknown;
}

type AnyNodeData = TerminalNodeData | NoteNodeData | ScreenshotNodeData | ScreenShareNodeData | HostNodeData | EditorNodeData;

function buildFlowNode(cn: CanvasNode, type: string, data: AnyNodeData): Node<AnyNodeData> {
  return {
    id: cn.id,
    type,
    position: { x: cn.x, y: cn.y },
    dragHandle: ".drag-handle",
    data,
    style: { width: cn.width, height: cn.height },
    measured: { width: cn.width, height: cn.height },
    zIndex: cn.zIndex,
  };
}

function buildServiceNodeData(cn: CanvasNode, services: ServiceInstance[], label: string): HostNodeData | EditorNodeData {
  const service = services.find((s) => s.id === cn.serviceInstanceId);
  return {
    serviceInstanceId: cn.serviceInstanceId!,
    serviceId: service?.serviceId ?? "",
    serviceName: service?.name ?? "Unknown",
    label,
  };
}

function canvasNodeToFlowNode(
  cn: CanvasNode,
  terminals: TerminalSession[],
  notes: NoteData[],
  screenshots: Screenshot[],
  services: ServiceInstance[],
): Node<AnyNodeData> {
  switch (cn.nodeType) {
    case "host":
      if (cn.serviceInstanceId) {
        return buildFlowNode(cn, "host", buildServiceNodeData(cn, services, "Host"));
      }
      break;

    case "editor":
      if (cn.serviceInstanceId) {
        return buildFlowNode(cn, "editor", buildServiceNodeData(cn, services, "Editor"));
      }
      break;

    case "note":
      if (cn.noteId) {
        const note = notes.find((n) => n.id === cn.noteId);
        return buildFlowNode(cn, "note", {
          noteId: cn.noteId,
          content: note?.content ?? "",
          label: "Note",
        });
      }
      break;

    case "screenshot":
      if (cn.screenshotId) {
        const shot = screenshots.find((s) => s.id === cn.screenshotId);
        return buildFlowNode(cn, "screenshot", {
          screenshotId: cn.screenshotId,
          imageData: shot?.imageData ?? "",
          monitorIndex: shot?.monitorIndex ?? 0,
          width: shot?.width ?? 0,
          height: shot?.height ?? 0,
          capturedAt: shot?.capturedAt ?? "",
          label: "Screenshot",
        });
      }
      break;
  }

  const terminal = terminals.find((t) => t.id === cn.terminalSessionId);
  return buildFlowNode(cn, "terminal", {
    terminalId: cn.terminalSessionId ?? cn.id,
    serviceId: terminal?.serviceId ?? null,
    serviceInstanceId: terminal?.serviceInstanceId ?? null,
    label: "Terminal",
    tags: terminal?.tags ?? [],
    status: terminal?.status ?? "active",
    exitCode: terminal?.exitCode ?? null,
  });
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

  const edgesQuery = useQuery({
    queryKey: ["canvas-edges", workspaceId],
    queryFn: () => api.listCanvasEdges(workspaceId),
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

  const screenshotsQuery = useQuery({
    queryKey: ["screenshots", workspaceId],
    queryFn: () => api.listScreenshots(workspaceId),
  });

  const servicesQuery = useQuery({
    queryKey: ["services", workspaceId],
    queryFn: () => api.listServices(workspaceId),
  });

  const createEditorMutation = useMutation({
    mutationFn: (req: CreateEditorNodeRequest) =>
      api.createEditorNode(workspaceId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });
    },
  });

  const terminals = terminalsQuery.data?.terminals ?? [];
  const notes = (notesQuery.data?.notes ?? []) as NoteData[];
  const screenshots = screenshotsQuery.data?.screenshots ?? [];
  const services = servicesQuery.data?.services ?? [];

  useEffect(() => {
    const canvasHub = getCanvasHub();

    function handleNodeAdded() {
      queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["screenshots", workspaceId] });
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

  // Ephemeral screen share nodes (shared via Zustand store)
  const screenShareNodes = useScreenShareStore((s) => s.nodes);
  const addScreenShareStoreNode = useScreenShareStore((s) => s.addNode);
  const removeScreenShareStoreNode = useScreenShareStore((s) => s.removeNode);

  const addScreenShareNode = useCallback(
    (sessionId: string, serviceId: string, monitorIndex: number, monitorName: string, monitorWidth: number, monitorHeight: number, sourceNodeId?: string) => {
      const nodeId = `stream-${sessionId}`;
      const sourceNode = (nodesQuery.data?.nodes ?? []).find((n) => n.id === sourceNodeId);
      const x = sourceNode ? sourceNode.x + 100 : 200;
      const y = sourceNode ? sourceNode.y + (sourceNode.height ?? 480) + 60 : 600;

      addScreenShareStoreNode({
        id: nodeId,
        type: "screen-share",
        position: { x, y },
        dragHandle: ".drag-handle",
        data: {
          sessionId,
          serviceId,
          monitorIndex,
          monitorName,
          monitorWidth,
          monitorHeight,
          sourceTerminalNodeId: sourceNodeId,
          label: "Screen Share",
        },
        style: { width: 800, height: 600 },
        measured: { width: 800, height: 600 },
        zIndex: 100,
      });
    },
    [nodesQuery.data, addScreenShareStoreNode],
  );

  const nodes: Node<AnyNodeData>[] = useMemo(
    () => [
      ...(nodesQuery.data?.nodes ?? []).map((cn) => canvasNodeToFlowNode(cn, terminals, notes, screenshots, services)),
      ...screenShareNodes,
    ],
    [nodesQuery.data, terminals, notes, screenshots, services, screenShareNodes],
  );

  const edges: Edge[] = useMemo(() => {
    const dbEdges = edgesQuery.data?.edges ?? [];
    const persistedEdges = dbEdges.map((e): Edge => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      animated: true,
      style: { stroke: "rgba(255,255,255,0.15)", strokeWidth: 1.5 },
    }));

    const streamEdges: Edge[] = screenShareNodes
      .filter((n) => n.data.sourceTerminalNodeId)
      .map((n): Edge => ({
        id: `edge-stream-${n.data.sessionId}`,
        source: n.data.sourceTerminalNodeId!,
        target: n.id,
        animated: true,
        style: { stroke: "rgba(120,255,190,0.2)", strokeWidth: 1.5 },
      }));

    return [...persistedEdges, ...streamEdges];
  }, [edgesQuery.data, screenShareNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<AnyNodeData>>[]) => {
      queryClient.setQueryData(
        ["canvas-nodes", workspaceId],
        (old: { nodes: CanvasNode[] } | undefined) => {
          if (!old) return old;

          const flowNodes = old.nodes.map((cn) => canvasNodeToFlowNode(cn, terminals, notes, screenshots, services));
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
    [queryClient, updateMutation, workspaceId, terminals, notes, screenshots, services],
  );

  return {
    nodes,
    edges,
    onNodesChange,
    deleteNode: deleteMutation.mutateAsync,
    deleteCanvasNode: deleteMutation.mutateAsync,
    createEditorNode: createEditorMutation.mutateAsync,
    addScreenShareNode,
    removeScreenShareNode: removeScreenShareStoreNode,
    isLoading: nodesQuery.isLoading,
  };
}

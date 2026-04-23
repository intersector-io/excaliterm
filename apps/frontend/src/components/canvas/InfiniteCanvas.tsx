import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  SelectionMode,
  addEdge,
  useReactFlow,
  type NodeTypes,
  type NodeMouseHandler,
  type Edge,
  type OnConnect,
} from "@xyflow/react";
import { Plus, Terminal, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { useCanvas, type TerminalNodeData } from "@/hooks/use-canvas";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useServices } from "@/hooks/use-services";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useDockCollapsed } from "@/hooks/use-dock-state";
import { TerminalNode } from "./TerminalNode";
import { NoteNode } from "./NoteNode";
import { ScreenshotNode } from "./ScreenshotNode";
import { ScreenShareNode } from "./ScreenShareNode";
import { HostNode } from "./HostNode";
import { EditorNode } from "./EditorNode";
import { CommandHistoryNode } from "./CommandHistoryNode";
import { TerminalFullScreen } from "@/components/terminal/TerminalFullScreen";
import { Button } from "@/components/ui/button";
import { useFullscreenStore } from "@/stores/fullscreen-store";
import { applyDagreLayout, buildHierarchyEdges } from "@/lib/dagre-layout";
import type { TerminalStatus } from "@excaliterm/shared-types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const nodeTypes: NodeTypes = {
  terminal: TerminalNode,
  note: NoteNode,
  screenshot: ScreenshotNode,
  "screen-share": ScreenShareNode,
  host: HostNode,
  editor: EditorNode,
  "command-history": CommandHistoryNode,
};

const defaultViewport = { x: 0, y: 0, zoom: 1 };

interface InfiniteCanvasProps {
  onFocusTerminalRef?: React.MutableRefObject<((nodeId: string) => void) | null>;
  onFullScreenRef?: React.MutableRefObject<((terminalId: string, status: string) => void) | null>;
  onAutoLayoutRef?: React.MutableRefObject<(() => void) | null>;
}

export function InfiniteCanvas({ onFocusTerminalRef, onFullScreenRef, onAutoLayoutRef }: Readonly<InfiniteCanvasProps>) {
  const { nodes, edges, onNodesChange, updateNodePosition } = useCanvas();
  const { createTerminal, isCreating, terminals } = useTerminals();
  const { createNote, isCreating: isCreatingNote } = useNotes();
  const { onlineCount } = useServices();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const dockCollapsed = useDockCollapsed();
  const terminalNodeCount = useMemo(() => nodes.filter((n) => n.type === "terminal").length, [nodes]);
  const hasDock = !isMobile && terminalNodeCount > 0;
  const minimapBottomOffset = hasDock ? (dockCollapsed ? 32 : 156) : 10;
  const reactFlow = useReactFlow();

  const fullScreenTerminal = useFullscreenStore((s) => s.terminal);
  const openFullScreen = useFullscreenStore((s) => s.open);
  const closeFullScreen = useFullscreenStore((s) => s.close);

  const noHost = onlineCount === 0;
  const isEmpty = nodes.length === 0;
  const prevNodeCount = useRef(nodes.length);

  // Restore focus from URL hash on mount
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || terminals.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#focus=")) return;
    const id = hash.slice(7);
    const terminal = terminals.find((t) => t.id === id);
    if (terminal) {
      restoredRef.current = true;
      openFullScreen({
        terminalId: terminal.id,
        status: terminal.status,
        tags: terminal.tags,
      });
    }
  }, [terminals, openFullScreen]);

  // Keep refs current for imperative callbacks (avoids re-running effects on every canvas change)
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;
  const terminalsRef = useRef(terminals);
  terminalsRef.current = terminals;
  const localEdgesRef = useRef<Edge[]>([]);
  const [localEdges, setLocalEdges] = useState<Edge[]>([]);

  // Auto-zoom to latest node when a new one is added
  useEffect(() => {
    if (nodes.length > prevNodeCount.current && nodes.length > 0) {
      const latestNode = nodes.at(-1);
      if (latestNode) {
        setTimeout(() => {
          reactFlow.fitView({
            nodes: [{ id: latestNode.id }],
            padding: isMobile ? 0.05 : 0.15,
            maxZoom: isMobile ? 0.5 : 0.85,
            duration: 400,
          });
        }, 100);
      }
    }
    prevNodeCount.current = nodes.length;
  }, [nodes.length, reactFlow, isMobile]);

  // Expose focus function to parent
  useEffect(() => {
    if (onFocusTerminalRef) {
      onFocusTerminalRef.current = (nodeId: string) => {
        const node = nodesRef.current.find((n) => n.id === nodeId);
        if (node) {
          reactFlow.fitView({
            nodes: [{ id: nodeId }],
            padding: isMobile ? 0.05 : 0.15,
            maxZoom: isMobile ? 0.5 : 0.85,
            duration: 400,
          });
        }
      };
    }
  }, [onFocusTerminalRef, reactFlow, isMobile]);

  // Expose fullscreen trigger to parent
  useEffect(() => {
    if (onFullScreenRef) {
      onFullScreenRef.current = (terminalId: string, status: string) => {
        const terminal = terminalsRef.current.find((t) => t.id === terminalId);
        openFullScreen({
          terminalId,
          status: (status as TerminalStatus) ?? "active",
          tags: terminal?.tags,
        });
      };
    }
  }, [onFullScreenRef, openFullScreen]);

  useEffect(() => {
    if (!onAutoLayoutRef) return;
    onAutoLayoutRef.current = () => {
      const currentNodes = nodesRef.current;
      const hierarchyEdges = buildHierarchyEdges(currentNodes, edgesRef.current);
      const layoutedNodes = applyDagreLayout(currentNodes, hierarchyEdges, "TB");
      reactFlow.setNodes(layoutedNodes);
      for (const n of layoutedNodes) {
        updateNodePosition(n.id, n.position.x, n.position.y).catch(() => {});
      }
      setTimeout(() => {
        reactFlow.fitView({ padding: 0.2, duration: 400 });
      }, 50);
    };
  }, [onAutoLayoutRef, reactFlow, updateNodePosition]);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setLocalEdges((eds) => {
        const next = addEdge(
          {
            ...connection,
            style: { stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 },
            animated: true,
          },
          eds,
        );
        localEdgesRef.current = next;
        return next;
      });
    },
    [],
  );

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);
  const fitViewOptions = useMemo(
    () => ({
      padding: isMobile ? 0.12 : 0.22,
      maxZoom: 1.02,
    }),
    [isMobile],
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!isMobile) return;
      if (node.type !== "terminal") return;
      const data = node.data as TerminalNodeData;
      openFullScreen({
        terminalId: data.terminalId,
        status: data.status,
        tags: data.tags,
      });
    },
    [isMobile],
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (isMobile) return;
      if (node.type !== "terminal") return;
      const data = node.data as TerminalNodeData;
      openFullScreen({
        terminalId: data.terminalId,
        status: data.status,
        tags: data.tags,
      });
    },
    [isMobile],
  );


  async function onNewTerminal() {
    if (noHost) {
      toast.error("No host available", {
        description:
          "Register and connect a service before creating terminals.",
      });
      return;
    }
    try {
      await createTerminal({});
      toast.success("Terminal created");
    } catch {
      toast.error("Failed to create terminal", {
        description: "The host service may have gone offline.",
      });
    }
  }

  async function onNewNote() {
    try {
      await createNote({});
    } catch {
      toast.error("Failed to create note");
    }
  }

  const terminalButtonLabel = noHost ? "No host connected" : isCreating ? "Creating..." : "New Terminal";

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={[...edges, ...localEdges]}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        proOptions={proOptions}
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={fitViewOptions}
        selectNodesOnDrag={false}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        panOnDrag={[0, 2]}
        panOnScroll
        zoomOnScroll
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255, 255, 255, 0.04)"
        />
        {!isMobile && !isEmpty && <Controls position="bottom-left" />}
        {!isMobile && nodes.length > 1 && (
          <MiniMap
            position="bottom-right"
            zoomable
            pannable
            nodeColor="rgba(255, 255, 255, 0.35)"
            nodeStrokeColor="rgba(255, 255, 255, 0.15)"
            nodeStrokeWidth={1}
            nodeBorderRadius={4}
            maskColor="rgba(0, 0, 0, 0.6)"
            style={{ bottom: minimapBottomOffset, transition: "bottom 150ms ease" }}
          />
        )}
      </ReactFlow>

      {/* Mobile FAB - only show when canvas has items */}
      {isMobile && !isEmpty && (
        <div className="absolute bottom-20 right-4 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full shadow-lg"
                disabled={isCreating || isCreatingNote}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end">
              <DropdownMenuItem onClick={onNewTerminal} disabled={isCreating || noHost}>
                <Terminal className="h-4 w-4" />
                <span>{terminalButtonLabel}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewNote} disabled={isCreatingNote}>
                <StickyNote className="h-4 w-4" />
                <span>{isCreatingNote ? "Creating..." : "New Note"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Full-screen terminal overlay (mobile: tap, desktop: double-click or menu) */}
      {fullScreenTerminal && (
        <TerminalFullScreen
          terminalId={fullScreenTerminal.terminalId}
          status={fullScreenTerminal.status}
          tags={fullScreenTerminal.tags}
          onBack={closeFullScreen}
          currentIndex={terminals.findIndex((t) => t.id === fullScreenTerminal.terminalId)}
          totalCount={terminals.length}
          onPrev={() => {
            const idx = terminals.findIndex((t) => t.id === fullScreenTerminal.terminalId);
            const prev = terminals[(idx - 1 + terminals.length) % terminals.length];
            if (prev) openFullScreen({ terminalId: prev.id, status: prev.status, tags: prev.tags });
          }}
          onNext={() => {
            const idx = terminals.findIndex((t) => t.id === fullScreenTerminal.terminalId);
            const next = terminals[(idx + 1) % terminals.length];
            if (next) openFullScreen({ terminalId: next.id, status: next.status, tags: next.tags });
          }}
        />
      )}
    </div>
  );
}

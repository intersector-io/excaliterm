import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  type NodeTypes,
  type NodeMouseHandler,
  type Edge,
  type OnConnect,
} from "@xyflow/react";
import { Plus, Terminal, StickyNote } from "lucide-react";
import { useCanvas, type TerminalNodeData } from "@/hooks/use-canvas";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useMediaQuery } from "@/hooks/use-media-query";
import { TerminalNode } from "./TerminalNode";
import { NoteNode } from "./NoteNode";
import { TerminalFullScreen } from "@/components/terminal/TerminalFullScreen";
import { Button } from "@/components/ui/button";
import type { TerminalStatus } from "@terminal-proxy/shared-types";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const nodeTypes: NodeTypes = {
  terminal: TerminalNode,
  note: NoteNode,
};

const defaultViewport = { x: 0, y: 0, zoom: 1 };

export function InfiniteCanvas() {
  const { nodes, edges, onNodesChange } = useCanvas();
  const { createTerminal, isCreating } = useTerminals();
  const { createNote, isCreating: isCreatingNote } = useNotes();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [localEdges, setLocalEdges] = useState<Edge[]>([]);

  const onConnect: OnConnect = useCallback(
    (connection) => {
      setLocalEdges((eds) =>
        addEdge(
          {
            ...connection,
            style: { stroke: "rgba(255,255,255,0.15)", strokeWidth: 1.5 },
            animated: true,
          },
          eds,
        ),
      );
    },
    [],
  );

  const [fullScreenTerminal, setFullScreenTerminal] = useState<{
    terminalId: string;
    status: TerminalStatus;
  } | null>(null);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!isMobile) return;
      if (node.type !== "terminal") return;
      const data = node.data as TerminalNodeData;
      setFullScreenTerminal({
        terminalId: data.terminalId,
        status: data.status,
      });
    },
    [isMobile],
  );

  const handleBackFromFullScreen = useCallback(() => {
    setFullScreenTerminal(null);
  }, []);

  async function onNewTerminal() {
    try {
      await createTerminal({});
    } catch (err) {
      console.error("Failed to create terminal:", err);
    }
  }

  async function onNewNote() {
    try {
      await createNote({});
    } catch (err) {
      console.error("Failed to create note:", err);
    }
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={[...edges, ...localEdges]}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        proOptions={proOptions}
        minZoom={0.1}
        maxZoom={2}
        fitView={false}
        selectNodesOnDrag={false}
        panOnScroll
        zoomOnScroll
        colorMode="dark"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255, 255, 255, 0.08)"
        />
        {!isMobile && <Controls position="bottom-left" />}
        {!isMobile && (
          <MiniMap
            position="bottom-right"
            zoomable
            pannable
            nodeColor="rgba(255, 255, 255, 0.15)"
          />
        )}
      </ReactFlow>

      {/* Mobile FAB */}
      {isMobile && (
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
              <DropdownMenuItem onClick={onNewTerminal} disabled={isCreating}>
                <Terminal className="h-4 w-4" />
                <span>{isCreating ? "Creating..." : "New Terminal"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewNote} disabled={isCreatingNote}>
                <StickyNote className="h-4 w-4" />
                <span>{isCreatingNote ? "Creating..." : "New Note"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Full-screen terminal overlay for mobile */}
      {fullScreenTerminal && (
        <TerminalFullScreen
          terminalId={fullScreenTerminal.terminalId}
          status={fullScreenTerminal.status}
          onBack={handleBackFromFullScreen}
        />
      )}
    </div>
  );
}

import { memo, useState, useCallback, useEffect, useMemo } from "react";
import { type NodeProps, NodeResizer, Handle, Position, useReactFlow } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { Code2, X, PanelLeftClose, PanelLeftOpen, Maximize2, Minimize2 } from "lucide-react";
import { useFiles } from "@/hooks/use-files";
import { useCanvas } from "@/hooks/use-canvas";
import {
  getEditorStore,
  removeEditorStore,
  EditorStoreContext,
} from "@/stores/editor-store";
import { FileTree } from "@/components/editor/FileTree";
import { EditorPane } from "@/components/editor/EditorPane";

export interface EditorNodeData {
  serviceInstanceId: string;
  serviceId: string;
  serviceName: string;
  label: string;
  [key: string]: unknown;
}

type EditorNodeType = Node<EditorNodeData>;

function EditorNodeComponent({ id, data, selected }: NodeProps<EditorNodeType>) {
  const [showTree, setShowTree] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [savedBounds, setSavedBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const { deleteCanvasNode } = useCanvas();
  const reactFlow = useReactFlow();

  const store = useMemo(() => getEditorStore(id), [id]);

  const {
    entries,
    currentPath,
    loading,
    listDirectory,
    readFile,
    writeFile,
  } = useFiles(data.serviceId);

  const handleSave = useCallback(
    async (path: string, content: string) => {
      await writeFile(path, content);
    },
    [writeFile],
  );

  const handleClose = useCallback(async () => {
    try {
      removeEditorStore(id);
      await deleteCanvasNode(id);
    } catch (err) {
      console.error("Failed to close editor node:", err);
    }
  }, [id, deleteCanvasNode]);

  const handleToggleMaximize = useCallback(() => {
    const node = reactFlow.getNode(id);
    if (!node) return;

    if (isMaximized && savedBounds) {
      // Restore
      reactFlow.setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                position: { x: savedBounds.x, y: savedBounds.y },
                style: { ...n.style, width: savedBounds.width, height: savedBounds.height },
                measured: { width: savedBounds.width, height: savedBounds.height },
              }
            : n,
        ),
      );
      setIsMaximized(false);
    } else {
      // Save current bounds and maximize to viewport
      setSavedBounds({
        x: node.position.x,
        y: node.position.y,
        width: node.measured?.width ?? 760,
        height: node.measured?.height ?? 520,
      });
      const viewport = reactFlow.getViewport();
      const viewW = window.innerWidth / viewport.zoom;
      const viewH = window.innerHeight / viewport.zoom;
      const padding = 40 / viewport.zoom;
      const x = -viewport.x / viewport.zoom + padding;
      const y = -viewport.y / viewport.zoom + padding;
      const w = viewW - padding * 2;
      const h = viewH - padding * 2;

      reactFlow.setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                position: { x, y },
                style: { ...n.style, width: w, height: h },
                measured: { width: w, height: h },
              }
            : n,
        ),
      );
      setIsMaximized(true);
    }
  }, [id, isMaximized, savedBounds, reactFlow]);

  // Clean up store on unmount
  useEffect(() => {
    return () => {
      removeEditorStore(id);
    };
  }, [id]);

  return (
    <EditorStoreContext.Provider value={store}>
      <NodeResizer
        minWidth={480}
        minHeight={300}
        isVisible={!!selected}
        lineClassName="!border-white/20"
        handleClassName="!w-2 !h-2 !bg-white/60 !border-0 !rounded-sm"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-white/40 !border-0 !rounded-sm"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-white/40 !border-0 !rounded-sm"
      />
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-accent-blue/12 shadow-[0_12px_40px_rgba(0,0,0,0.35)] bg-surface-raised">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-border-subtle px-3.5 drag-handle min-h-[40px] py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Code2 className="h-3.5 w-3.5 shrink-0 text-accent-blue/60" />
            <span className="truncate text-body-sm font-medium text-white/60">
              Editor — {data.serviceName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTree((v) => !v)}
              className="nodrag nopan p-1.5 rounded-md hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70"
              title={showTree ? "Hide files" : "Show files"}
            >
              {showTree ? (
                <PanelLeftClose className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={handleToggleMaximize}
              className="nodrag nopan p-1.5 rounded-md hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70"
              title={isMaximized ? "Restore size" : "Maximize"}
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="nodrag nopan p-1.5 rounded-md hover:bg-red-500/20 transition-colors text-white/40 hover:text-red-400"
              title="Close editor"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="nodrag nopan nowheel flex flex-1 overflow-hidden">
          {showTree && (
            <div className="flex w-52 shrink-0 flex-col border-r border-border-subtle overflow-hidden">
              <div className="flex-1 overflow-hidden pt-1">
                <FileTree
                  serviceId={data.serviceId}
                  listDirectory={listDirectory}
                  readFile={readFile}
                  entries={entries}
                  currentPath={currentPath}
                  loading={loading}
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <EditorPane onSave={handleSave} />
          </div>
        </div>
      </div>
    </EditorStoreContext.Provider>
  );
}

export const EditorNode = memo(EditorNodeComponent);

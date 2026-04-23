import { memo, useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  type NodeProps,
  NodeResizer,
  Handle,
  Position,
  type Node,
} from "@xyflow/react";
import {
  Code2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useFiles } from "@/hooks/use-files";
import { useCanvas } from "@/hooks/use-canvas";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useHover } from "@/hooks/use-hover";
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

function EditorNodeComponent({
  id,
  data,
  selected,
}: NodeProps<EditorNodeType>) {
  const [showTree, setShowTree] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const { deleteCanvasNode } = useCanvas();
  const { isFullscreen, toggleFullscreen } = useFullscreen(contentRef);
  const { hovered, onMouseEnter, onMouseLeave } = useHover();

  const store = useMemo(() => getEditorStore(id), [id]);

  const { entries, currentPath, loading, listDirectory, readFile, writeFile } =
    useFiles(data.serviceId);

  const handleSave = useCallback(
    (path: string, content: string) => writeFile(path, content),
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

  useEffect(() => {
    return () => {
      removeEditorStore(id);
    };
  }, [id]);

  return (
    <EditorStoreContext.Provider value={store}>
      <div
        className="h-full w-full"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <NodeResizer
          minWidth={480}
          minHeight={300}
          isVisible={!!selected || hovered}
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
        <div
          ref={contentRef}
          className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-accent-blue/12 bg-surface-raised shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        >
          <div className="drag-handle relative z-10 flex min-h-[40px] items-center justify-between border-b border-border-subtle px-3.5 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <Code2 className="h-3.5 w-3.5 shrink-0 text-accent-blue/60" />
              <span className="truncate text-body-sm font-medium text-white/60">
                Editor &mdash; {data.serviceName}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowTree((v) => !v)}
                className="nodrag nopan rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70"
                title={showTree ? "Hide files" : "Show files"}
              >
                {showTree ? (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={toggleFullscreen}
                className="nodrag nopan rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={handleClose}
                className="nodrag nopan rounded-md p-1.5 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
                title="Close editor"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="nodrag nopan nowheel flex flex-1 overflow-hidden">
            {showTree && (
              <div className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-border-subtle">
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
      </div>
    </EditorStoreContext.Provider>
  );
}

export const EditorNode = memo(EditorNodeComponent);

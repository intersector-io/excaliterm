import { memo, useCallback, useState, useRef, useEffect } from "react";
import { type NodeProps, NodeResizer, Handle, Position } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { useNotes } from "@/hooks/use-notes";
import { useMediaQuery } from "@/hooks/use-media-query";
import { X, Pencil } from "lucide-react";

export interface NoteNodeData {
  noteId: string;
  content: string;
  label: string;
  [key: string]: unknown;
}

type NoteNodeType = Node<NoteNodeData>;

function NoteNodeComponent({ data, selected }: NodeProps<NoteNodeType>) {
  const { updateNote, deleteNote } = useNotes();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [content, setContent] = useState(data.content);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external content changes
  useEffect(() => {
    if (!isEditing) {
      setContent(data.content);
    }
  }, [data.content, isEditing]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      updateNote(data.noteId, newContent);
    },
    [data.noteId, updateNote],
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await deleteNote(data.noteId);
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  }, [data.noteId, deleteNote]);

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={!!selected}
        lineClassName="!border-accent-amber"
        handleClassName="!w-2.5 !h-2.5 !bg-accent-amber !border-accent-amber !rounded-full"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-accent-amber !border-surface-raised"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-accent-amber !border-surface-raised"
      />
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-lg border-l-4 border border-border border-l-accent-amber ${
          isMobile ? "shadow-none" : "shadow-2xl"
        } bg-surface-raised`}
      >
        {/* Title bar */}
        <div
          className={`flex items-center justify-between border-b border-border/50 bg-surface-sunken px-3 drag-handle ${
            isMobile ? "min-h-[44px]" : "h-8"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground/60">
              Note
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleEdit}
              className="p-1 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
              title="Edit note"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={handleClose}
              className="p-1 rounded hover:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-400"
              title="Delete note"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        {/* Note content */}
        <div className="nodrag nopan nowheel flex-1 overflow-auto p-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onFocus={() => setIsEditing(true)}
            onBlur={handleBlur}
            className="h-full w-full resize-none bg-transparent text-sm text-foreground font-sans outline-none placeholder:text-muted-foreground/50"
            placeholder="Write something..."
          />
        </div>
      </div>
    </>
  );
}

export const NoteNode = memo(NoteNodeComponent);

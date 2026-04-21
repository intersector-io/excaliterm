import { memo, useCallback, useState, useRef, useEffect } from "react";
import { type NodeProps, NodeResizer, Handle, Position } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNotes } from "@/hooks/use-notes";
import { useMediaQuery } from "@/hooks/use-media-query";
import { X, Pencil, StickyNote, Check } from "lucide-react";

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

  const hasContent = content.trim().length > 0;

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={!!selected}
        lineClassName="!border-accent-amber/40"
        handleClassName="!w-2.5 !h-2.5 !bg-accent-amber !border-0 !rounded-full !shadow-[0_0_6px_rgba(251,191,36,0.3)]"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-accent-amber/60 !border-0 !rounded-full"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-accent-amber/60 !border-0 !rounded-full"
      />
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-accent-amber/15 ${
          isMobile ? "" : "shadow-[0_28px_80px_rgba(0,0,0,0.42)]"
        } bg-[linear-gradient(135deg,rgba(251,191,36,0.06),transparent_40%)] bg-surface-raised`}
      >
        {/* Title bar */}
        <div
          className={`flex items-center justify-between border-b border-white/[0.05] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] px-4 drag-handle ${
            isMobile ? "min-h-[44px]" : "min-h-[44px]"
          } py-2`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 shrink-0 rounded-full bg-accent-amber/60" />
            <span className="text-body-sm font-medium text-white/60">
              Note
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={isEditing ? handleBlur : handleEdit}
              className="nodrag nopan p-1.5 rounded-md hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70"
              title={isEditing ? "Done editing" : "Edit note"}
            >
              {isEditing ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="nodrag nopan p-1.5 rounded-md hover:bg-red-500/20 transition-colors text-white/40 hover:text-red-400"
              title="Delete note"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Note content */}
        <div className="nodrag nopan nowheel flex-1 overflow-auto p-4">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onBlur={handleBlur}
              className="h-full w-full resize-none bg-transparent text-body-sm text-foreground font-sans outline-none placeholder:text-muted-foreground/40 leading-relaxed"
              placeholder="Write something... (Markdown supported)"
            />
          ) : hasContent ? (
            <div
              className="chat-markdown text-body-sm text-foreground/90 leading-relaxed cursor-text"
              onDoubleClick={handleEdit}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div
              className="flex h-full items-center justify-center cursor-text"
              onDoubleClick={handleEdit}
              onClick={handleEdit}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <StickyNote className="h-5 w-5 text-accent-amber/30" />
                <span className="text-body-sm text-muted-foreground/40">
                  Double-click to write
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const NoteNode = memo(NoteNodeComponent);

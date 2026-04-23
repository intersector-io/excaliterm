import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { StickyNote, ArrowLeft, Trash2 } from "lucide-react";
import { useNotes, type NoteData } from "@/hooks/use-notes";

export function MobileNotesSection() {
  const { notes, updateNote, deleteNote } = useNotes();
  const [editingNote, setEditingNote] = useState<NoteData | null>(null);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteNote(id);
      } catch {
        // ignore
      }
    },
    [deleteNote],
  );

  if (notes.length === 0) return null;

  return (
    <>
      <div className="space-y-1.5">
        <h3 className="flex items-center gap-1.5 px-1 text-caption font-medium uppercase tracking-wider text-muted-foreground/60">
          <span>Notes</span>
          <span className="text-muted-foreground/30">{notes.length}</span>
        </h3>
        {notes.map((note) => (
          <div
            key={note.id}
            role="button"
            tabIndex={0}
            onClick={() => setEditingNote(note)}
            onKeyDown={(e) => { if (e.key === "Enter") setEditingNote(note); }}
            className="flex w-full items-center gap-3 rounded-xl border border-border-default border-l-[3px] border-l-accent-amber bg-surface-raised/60 px-4 py-3 text-left transition-all active:scale-[0.98] active:bg-surface-raised cursor-pointer"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-sunken/50">
              <StickyNote className="h-4.5 w-4.5 text-accent-amber/70" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-3 text-body-sm leading-relaxed text-foreground/80">
                {note.content || "Empty note"}
              </p>
              <span className="mt-1 block text-caption text-muted-foreground/50">
                {new Date(note.updatedAt).toLocaleString()}
              </span>
            </div>
            <button
              onClick={(e) => handleDelete(note.id, e)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/30 transition-colors active:bg-accent-red/10 active:text-accent-red"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {editingNote && (
        <NoteFullScreen
          note={editingNote}
          onBack={() => setEditingNote(null)}
          onUpdate={updateNote}
        />
      )}
    </>
  );
}

/* ─── Fullscreen Note Editor ─────────────────────────────────────────────── */

function NoteFullScreen({
  note,
  onBack,
  onUpdate,
}: {
  note: NoteData;
  onBack: () => void;
  onUpdate: (id: string, content: string) => void;
}) {
  const [content, setContent] = useState(note.content);

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      onUpdate(note.id, value);
    },
    [note.id, onUpdate],
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <button
          onClick={onBack}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-surface-raised"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <StickyNote className="h-4 w-4 text-accent-amber/70" />
        <span className="text-body-sm font-medium text-foreground">Note</span>
        <span className="ml-auto text-caption text-muted-foreground/50">
          {new Date(note.updatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden p-3">
        <textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          className="h-full w-full resize-none rounded-lg border border-border-subtle bg-surface-sunken p-4 font-mono text-body-sm leading-relaxed text-foreground placeholder:text-muted-foreground/30 focus:border-accent-amber/30 focus:outline-none"
          placeholder="Write something..."
          autoFocus
        />
      </div>
    </div>,
    document.body,
  );
}

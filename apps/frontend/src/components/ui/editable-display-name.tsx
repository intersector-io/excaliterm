import { useState, useCallback, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { updateCollaboratorDisplayName } from "@/lib/collaborator";

interface EditableDisplayNameProps {
  className?: string;
}

export function EditableDisplayName({ className }: Readonly<EditableDisplayNameProps>) {
  const { collaborator, setCollaborator } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(collaborator.displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    const updated = updateCollaboratorDisplayName(value);
    setCollaborator(updated);
    setEditing(false);
  }, [value, setCollaborator]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSave();
      if (e.key === "Escape") {
        setValue(collaborator.displayName);
        setEditing(false);
      }
    },
    [handleSave, collaborator.displayName],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`rounded-md border border-accent-cyan/30 bg-surface-sunken px-1.5 py-0.5 text-foreground outline-none focus:border-accent-cyan/50 ${className ?? "text-caption"}`}
        style={{ width: `${Math.max(value.length, 6)}ch` }}
      />
    );
  }

  return (
    <button
      onClick={() => {
        setValue(collaborator.displayName);
        setEditing(true);
      }}
      className={`group flex items-center gap-1 truncate text-muted-foreground/70 transition-colors active:text-foreground ${className ?? "text-caption"}`}
    >
      <span className="truncate">{collaborator.displayName}</span>
      <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100" />
    </button>
  );
}

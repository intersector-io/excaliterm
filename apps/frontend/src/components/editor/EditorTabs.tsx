import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";

export function EditorTabs() {
  const { openFiles, activeFile, setActiveFile, closeFile } = useEditorStore();

  const tabs = Array.from(openFiles.entries());

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface-sunken scrollbar-thin">
      {tabs.map(([path, file]) => {
        const fileName = path.split(/[/\\]/).pop() ?? path;
        const isActive = path === activeFile;

        return (
          <div
            key={path}
            className={cn(
              "group flex min-w-0 max-w-48 shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-sm transition-colors",
              isActive
                ? "bg-background text-foreground"
                : "bg-surface-sunken text-muted-foreground hover:bg-background/50 hover:text-foreground",
            )}
            onClick={() => setActiveFile(path)}
          >
            {/* Dirty indicator */}
            {file.isDirty && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent-amber" />
            )}

            <span className="flex-1 truncate">{fileName}</span>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(path);
              }}
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors",
                "opacity-0 hover:bg-accent/80 group-hover:opacity-100",
                isActive && "opacity-100",
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

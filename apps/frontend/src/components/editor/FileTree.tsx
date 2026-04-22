import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, FolderRoot, FolderOpen } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { getLanguageFromPath } from "@/lib/language-map";
import { FileTreeItem } from "./FileTreeItem";
import type { FileEntryDto } from "@excaliterm/shared-types";

interface FileTreeProps {
  serviceId: string | null;
  listDirectory: (path: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  entries: FileEntryDto[];
  currentPath: string;
  loading: boolean;
  onFileSelect?: () => void;
}

export function FileTree({
  serviceId,
  listDirectory,
  readFile,
  entries,
  currentPath,
  loading,
  onFileSelect,
}: Readonly<FileTreeProps>) {
  const [filter, setFilter] = useState("");
  const [dirContents, setDirContents] = useState<Map<string, FileEntryDto[]>>(new Map());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());

  const { expandedDirs, toggleDir, activeFile, openFile } = useEditorStore();

  // Load root when serviceId changes
  useEffect(() => {
    if (!serviceId) {
      setDirContents(new Map());
      return;
    }
    setDirContents(new Map());
    listDirectory("");
  }, [serviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync entries from hook into dirContents cache
  useEffect(() => {
    if (entries.length > 0 || !loading) {
      setDirContents((prev) => {
        const next = new Map(prev);
        next.set(currentPath, entries);
        return next;
      });
      setLoadingDirs((prev) => {
        if (!prev.has(currentPath)) return prev;
        const next = new Set(prev);
        next.delete(currentPath);
        return next;
      });
    }
  }, [entries, currentPath, loading]);

  const handleToggleDir = useCallback(
    (path: string) => {
      toggleDir(path);
      // Load contents when expanding (if not already loaded)
      if (!expandedDirs.has(path) && !dirContents.has(path)) {
        setLoadingDirs((prev) => new Set(prev).add(path));
        listDirectory(path);
      }
    },
    [toggleDir, expandedDirs, dirContents, listDirectory],
  );

  const handleFileClick = useCallback(
    async (entry: FileEntryDto) => {
      const lang = getLanguageFromPath(entry.path);

      try {
        const content = await readFile(entry.path);
        openFile(entry.path, content, lang);
        onFileSelect?.();
      } catch (err) {
        console.error("Failed to read file:", err);
      }
    },
    [readFile, openFile, onFileSelect],
  );

  const renderEntries = useCallback(
    (parentPath: string, depth: number): React.ReactNode[] => {
      const dirEntries = dirContents.get(parentPath);
      if (!dirEntries) return [];

      // Sort: directories first, then alphabetically
      const sorted = [...dirEntries].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      // Apply filter (only at root level for simplicity)
      const filtered =
        filter && depth === 0
          ? sorted.filter((e) =>
              e.name.toLowerCase().includes(filter.toLowerCase()),
            )
          : sorted;

      const result: React.ReactNode[] = [];

      for (const entry of filtered) {
        const isExpanded = expandedDirs.has(entry.path);
        const isActive = activeFile === entry.path;
        const isLoadingDir = loadingDirs.has(entry.path);

        result.push(
          <FileTreeItem
            key={entry.path}
            name={entry.name}
            isDirectory={entry.isDirectory}
            isExpanded={isExpanded}
            isActive={isActive}
            depth={depth}
            onToggle={() => handleToggleDir(entry.path)}
            onClick={() => handleFileClick(entry)}
          />,
        );

        if (entry.isDirectory && isExpanded) {
          if (isLoadingDir && !dirContents.has(entry.path)) {
            result.push(
              <div
                key={`${entry.path}-loading`}
                className="py-1 text-xs text-muted-foreground"
                style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
              >
                Loading...
              </div>,
            );
          } else {
            result.push(...renderEntries(entry.path, depth + 1));
          }
        }
      }

      return result;
    },
    [dirContents, expandedDirs, activeFile, filter, loadingDirs, handleToggleDir, handleFileClick],
  );

  const treeItems = useMemo(() => renderEntries("", 0), [renderEntries]);

  if (!serviceId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        Select a service to browse files
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search input */}
      <div className="relative px-2 pb-2">
        <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files..."
          className="h-7 w-full rounded-md border border-border bg-surface-sunken pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-3 pb-1 text-xs text-muted-foreground">
        <FolderRoot className="h-3 w-3" />
        <span className="truncate">/</span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-1">
        {loading && treeItems.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            Loading files...
          </div>
        )}
        {!(loading && treeItems.length === 0) && treeItems.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-muted-foreground">
            <FolderOpen className="h-8 w-8 opacity-30" />
            <p className="text-xs">
              {filter ? "No matching files" : "Empty directory"}
            </p>
            {!filter && (
              <p className="text-caption text-muted-foreground/60">
                Configure whitelisted paths in your service settings
              </p>
            )}
          </div>
        )}
        {!(loading && treeItems.length === 0) && treeItems.length > 0 && treeItems}
      </div>
    </div>
  );
}

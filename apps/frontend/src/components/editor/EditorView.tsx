import { useState, useCallback, useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useServices } from "@/hooks/use-services";
import { useFiles } from "@/hooks/use-files";
import { ServiceSelector } from "./ServiceSelector";
import { FileTree } from "./FileTree";
import { EditorPane } from "./EditorPane";

interface EditorViewProps {
  initialServiceId?: string;
}

export function EditorView({ initialServiceId }: Readonly<EditorViewProps> = {}) {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialServiceId ?? null);
  const [showTree, setShowTree] = useState(true);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const { services } = useServices();

  const {
    entries,
    currentPath,
    loading,
    listDirectory,
    readFile,
    writeFile,
  } = useFiles(selectedServiceId);

  // Default to first online service
  useEffect(() => {
    if (!selectedServiceId && services.length > 0) {
      const online = services.find((s) => s.status === "online");
      const first = services[0];
      setSelectedServiceId(online?.id ?? first?.id ?? null);
    }
  }, [services, selectedServiceId]);

  const handleFileSelect = useCallback(() => {
    // On mobile, switch from tree to editor when a file is selected
    if (isMobile) {
      setShowTree(false);
    }
  }, [isMobile]);

  // Mobile layout: toggle between tree and editor
  if (isMobile) {
    return (
      <div className="flex h-full flex-col">
        {/* Mobile toolbar */}
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
          <button
            onClick={() => setShowTree(!showTree)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            {showTree ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
          <div className="flex-1 overflow-hidden">
            <ServiceSelector
              selectedServiceId={selectedServiceId}
              onSelect={setSelectedServiceId}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {showTree ? (
            <FileTree
              serviceId={selectedServiceId}
              listDirectory={listDirectory}
              readFile={readFile}
              entries={entries}
              currentPath={currentPath}
              loading={loading}
              onFileSelect={handleFileSelect}
            />
          ) : (
            <EditorPane onSave={writeFile} />
          )}
        </div>
      </div>
    );
  }

  // Desktop / Tablet layout: sidebar + editor
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      {showTree && (
        <div className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
          {/* Service selector */}
          <div className="border-b border-border p-2">
            <ServiceSelector
              selectedServiceId={selectedServiceId}
              onSelect={setSelectedServiceId}
            />
          </div>

          {/* File tree */}
          <div className="flex-1 overflow-hidden pt-2">
            <FileTree
              serviceId={selectedServiceId}
              listDirectory={listDirectory}
              readFile={readFile}
              entries={entries}
              currentPath={currentPath}
              loading={loading}
            />
          </div>
        </div>
      )}

      {/* Toggle sidebar button */}
      <button
        onClick={() => setShowTree(!showTree)}
        className="flex w-6 shrink-0 items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        title={showTree ? "Hide file tree" : "Show file tree"}
      >
        {showTree ? (
          <PanelLeftClose className="h-3.5 w-3.5" />
        ) : (
          <PanelLeftOpen className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Editor pane */}
      <div className="flex-1 overflow-hidden">
        <EditorPane onSave={writeFile} />
      </div>
    </div>
  );
}

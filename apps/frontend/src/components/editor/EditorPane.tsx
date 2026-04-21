import { useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { Save, Lock, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { THEME_NAME, excalitermDarkTheme } from "@/lib/monaco-theme";
import { EditorTabs } from "./EditorTabs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MonacoEditor = any;

const MonacoEditorLazy = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.Editor })),
);

interface EditorPaneProps {
  onSave: (path: string, content: string) => Promise<void>;
  readOnly?: boolean;
}

export function EditorPane({ onSave, readOnly = false }: EditorPaneProps) {
  const { openFiles, activeFile, updateContent, markSaved } = useEditorStore();
  const editorRef = useRef<MonacoEditor>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const activeFileData = activeFile ? openFiles.get(activeFile) : undefined;

  const handleEditorDidMount = useCallback(
    (editor: MonacoEditor, monaco: MonacoEditor) => {
      editorRef.current = editor;

      // Register custom theme
      monaco.editor.defineTheme(THEME_NAME, excalitermDarkTheme);
      monaco.editor.setTheme(THEME_NAME);

      // Ctrl+S / Cmd+S to save
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const currentPath = useEditorStore.getState().activeFile;
        const currentFile = currentPath
          ? useEditorStore.getState().openFiles.get(currentPath)
          : undefined;

        if (currentPath && currentFile?.isDirty) {
          onSave(currentPath, currentFile.content).then(() => {
            markSaved(currentPath, currentFile.content);
          });
        }
      });

      // Focus the editor
      editor.focus();
    },
    [onSave, markSaved],
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (activeFile && value !== undefined) {
        updateContent(activeFile, value);
      }
    },
    [activeFile, updateContent],
  );

  const handleSaveClick = useCallback(async () => {
    if (!activeFile || !activeFileData?.isDirty) return;
    await onSave(activeFile, activeFileData.content);
    markSaved(activeFile, activeFileData.content);
  }, [activeFile, activeFileData, onSave, markSaved]);

  // Update editor model when active file changes
  useEffect(() => {
    if (editorRef.current && activeFileData) {
      const model = editorRef.current.getModel();
      if (model && model.getValue() !== activeFileData.content) {
        model.setValue(activeFileData.content);
      }
    }
  }, [activeFile, activeFileData]);

  if (!activeFile || !activeFileData) {
    return (
      <div className="flex h-full flex-col">
        <EditorTabs />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/40 bg-surface-raised/40">
              <FileCode className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground/80">No file open</p>
              <p className="mt-1 text-xs">Select a file from the tree to start editing</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorTabs />

      {/* Mobile save toolbar */}
      {isMobile && (
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface-sunken px-3">
          <div className="flex items-center gap-2 overflow-hidden">
            {readOnly && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <span className="truncate text-xs text-muted-foreground">
              {activeFile}
            </span>
          </div>
          <button
            onClick={handleSaveClick}
            disabled={!activeFileData.isDirty || readOnly}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeFileData.isDirty && !readOnly
                ? "bg-accent-blue text-white hover:bg-accent-blue/90"
                : "bg-secondary text-muted-foreground",
            )}
          >
            <Save className="h-3 w-3" />
            Save
          </button>
        </div>
      )}

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading editor...
            </div>
          }
        >
          <MonacoEditorLazy
            key={activeFile}
            defaultValue={activeFileData.content}
            language={activeFileData.language}
            theme={THEME_NAME}
            onChange={handleChange}
            onMount={handleEditorDidMount}
            options={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              lineHeight: 20,
              minimap: { enabled: !isMobile },
              wordWrap: isMobile ? "on" : "off",
              readOnly: readOnly,
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              bracketPairColorization: { enabled: true },
              renderLineHighlight: "line",
              renderWhitespace: "selection",
              tabSize: 2,
              automaticLayout: true,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

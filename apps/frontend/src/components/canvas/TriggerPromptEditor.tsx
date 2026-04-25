import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_NAME, excalitermDarkTheme } from "@/lib/monaco-theme";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TriggerPromptLanguage } from "@excaliterm/shared-types";

const MonacoEditorLazy = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.Editor })),
);

const LANGUAGES: { value: TriggerPromptLanguage; label: string; monaco: string }[] = [
  { value: "shell",      label: "Shell",      monaco: "shell" },
  { value: "powershell", label: "PowerShell", monaco: "powershell" },
  { value: "bash",       label: "Bash",       monaco: "shell" },
  { value: "sql",        label: "SQL",        monaco: "sql" },
  { value: "plaintext",  label: "Plain text", monaco: "plaintext" },
];

interface TriggerPromptEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt: string;
  initialLanguage: TriggerPromptLanguage;
  onSave: (prompt: string, language: TriggerPromptLanguage) => void;
  readOnly?: boolean;
}

export function TriggerPromptEditor({
  open,
  onOpenChange,
  initialPrompt,
  initialLanguage,
  onSave,
  readOnly = false,
}: Readonly<TriggerPromptEditorProps>) {
  const [draft, setDraft] = useState(initialPrompt);
  const [language, setLanguage] = useState<TriggerPromptLanguage>(initialLanguage);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialPrompt);
      setLanguage(initialLanguage);
    }
  }, [open, initialPrompt, initialLanguage]);

  const handleEditorMount = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor: any, monaco: any) => {
      editorRef.current = editor;
      monaco.editor.defineTheme(THEME_NAME, excalitermDarkTheme);
      monaco.editor.setTheme(THEME_NAME);
      editor.focus();
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave(editor.getValue(), language);
        onOpenChange(false);
      });
    },
    [onSave, onOpenChange, language],
  );

  const handleSave = useCallback(() => {
    onSave(draft, language);
    onOpenChange(false);
  }, [draft, language, onSave, onOpenChange]);

  const monacoLang = LANGUAGES.find((l) => l.value === language)?.monaco ?? "plaintext";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[min(960px,90vw)] gap-0 p-0 overflow-hidden">
        <DialogTitle className="sr-only">Edit trigger prompt</DialogTitle>

        <div className="flex items-center justify-between border-b border-border-subtle/60 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-accent-amber/90">
              Prompt
            </span>
            <span className="text-caption text-muted-foreground">
              Multi-line scripts are submitted as-is, with a final Enter.
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                onClick={() => setLanguage(l.value)}
                disabled={readOnly}
                className={cn(
                  "rounded-md px-2 py-1 text-caption font-medium transition-colors",
                  language === l.value
                    ? "bg-amber-400/15 text-accent-amber"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white/80",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[clamp(360px,60vh,640px)] bg-surface-sunken">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-caption text-muted-foreground">
                Loading editor…
              </div>
            }
          >
            <MonacoEditorLazy
              value={draft}
              language={monacoLang}
              onChange={(v) => setDraft(v ?? "")}
              onMount={handleEditorMount}
              theme={THEME_NAME}
              options={{
                readOnly,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 13,
                minimap: { enabled: false },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: "line",
                smoothScrolling: true,
                cursorBlinking: "smooth",
              }}
            />
          </Suspense>
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle/60 px-5 py-3">
          <span className="font-mono text-caption text-muted-foreground/70">
            <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">⌘S</kbd> save · <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5">Esc</kbd> close
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-body-sm text-white/70 hover:bg-white/[0.08] hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={readOnly}
              className="flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/15 px-3 py-1.5 text-body-sm font-medium text-accent-amber hover:bg-amber-400/25 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

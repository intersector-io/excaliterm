import { createPortal } from "react-dom";
import { ArrowLeft, FileCode } from "lucide-react";
import { EditorView } from "./EditorView";

interface EditorFullScreenProps {
  serviceId: string;
  onBack: () => void;
}

export function EditorFullScreen({ serviceId, onBack }: Readonly<EditorFullScreenProps>) {
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
        <FileCode className="h-4 w-4 text-accent-blue/70" />
        <span className="text-body-sm font-medium text-foreground">Editor</span>
      </div>

      {/* Editor fills the rest */}
      <div className="flex-1 overflow-hidden">
        <EditorView initialServiceId={serviceId} />
      </div>
    </div>,
    document.body,
  );
}

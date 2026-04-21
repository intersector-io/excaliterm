import { toast } from "sonner";
import { Terminal, StickyNote, Server, ArrowRight, Zap } from "lucide-react";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useServices } from "@/hooks/use-services";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";

interface CanvasEmptyStateProps {
  onNavigateToServices?: () => void;
}

export function CanvasEmptyState({
  onNavigateToServices,
}: CanvasEmptyStateProps) {
  const { createTerminal, isCreating } = useTerminals();
  const { createNote, isCreating: isCreatingNote } = useNotes();
  const { onlineCount } = useServices();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const noHost = onlineCount === 0;

  async function handleCreateTerminal() {
    if (noHost) {
      toast.error("No host available", {
        description:
          "Register and connect a service before creating terminals.",
      });
      return;
    }
    try {
      await createTerminal({});
      toast.success("Terminal created");
    } catch {
      toast.error("Failed to create terminal", {
        description: "The host service may have gone offline.",
      });
    }
  }

  async function handleCreateNote() {
    try {
      await createNote({});
    } catch {
      toast.error("Failed to create note");
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto pointer-events-none">
      <div
        className={`pointer-events-auto flex flex-col items-center gap-5 text-center ${
          isMobile ? "px-6 py-8 max-w-[340px]" : "max-w-[480px] px-8"
        }`}
      >
        {/* Icon cluster */}
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent-cyan/15 bg-accent-cyan/[0.06] shadow-[0_0_80px_rgba(34,211,238,0.08)]">
            <Terminal
              className="h-7 w-7 text-accent-cyan/70"
              strokeWidth={1.5}
            />
          </div>
          <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-accent-green/20 bg-accent-green/10">
            <Zap className="h-3.5 w-3.5 text-accent-green" strokeWidth={2} />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2
            className={`font-semibold tracking-tight text-foreground ${
              isMobile ? "text-lg" : "text-xl"
            }`}
          >
            Your canvas is empty
          </h2>
          <p
            className={`leading-relaxed text-muted-foreground ${
              isMobile ? "text-xs" : "text-sm"
            }`}
          >
            {noHost
              ? "Connect a host service to start creating terminal sessions on this canvas."
              : "Create terminal sessions and notes on this infinite canvas. Drag, resize, and collaborate in real time."}
          </p>
        </div>

        {/* Action area */}
        {noHost ? (
          <div className="flex w-full flex-col items-center gap-3">
            {/* Primary: connect a host */}
            <Button
              onClick={onNavigateToServices}
              className={`gap-2 rounded-xl border border-accent-cyan/20 bg-accent-cyan/12 text-accent-cyan shadow-[0_8px_32px_rgba(34,211,238,0.1)] transition-all hover:bg-accent-cyan/20 hover:shadow-[0_12px_40px_rgba(34,211,238,0.15)] ${
                isMobile ? "h-11 w-full text-sm" : "h-10 px-5 text-sm"
              }`}
            >
              <Server className="h-4 w-4" />
              Register a service
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>

            {/* Secondary: add a note while waiting */}
            <button
              onClick={handleCreateNote}
              disabled={isCreatingNote}
              className={`flex items-center gap-1.5 text-muted-foreground/70 transition-colors hover:text-muted-foreground ${
                isMobile ? "text-xs" : "text-xs"
              }`}
            >
              <StickyNote className="h-3 w-3" />
              {isCreatingNote ? "Creating..." : "or add a note while you wait"}
            </button>

            {/* Setup hint */}
            <div
              className={`mt-2 w-full rounded-xl border border-border/50 bg-surface-raised/40 backdrop-blur-sm ${
                isMobile ? "px-4 py-3" : "px-5 py-4"
              }`}
            >
              <p className="text-caption font-medium text-muted-foreground/80">
                How it works
              </p>
              <ol className="mt-2 space-y-1.5 text-left">
                {[
                  "Register a service in the Services tab",
                  "Run the terminal agent with the provided config",
                  "Create terminals on this canvas",
                ].map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-caption text-muted-foreground/60"
                  >
                    <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-cyan/10 text-caption font-bold text-accent-cyan/70">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center gap-2 ${isMobile ? "w-full flex-col" : ""}`}
          >
            <Button
              onClick={handleCreateTerminal}
              disabled={isCreating}
              className={`gap-2 rounded-xl border border-accent-cyan/20 bg-accent-cyan/12 text-accent-cyan shadow-[0_8px_32px_rgba(34,211,238,0.1)] transition-all hover:bg-accent-cyan/20 hover:shadow-[0_12px_40px_rgba(34,211,238,0.15)] ${
                isMobile ? "h-11 w-full text-sm" : "h-10 px-5 text-sm"
              }`}
            >
              <Terminal className="h-4 w-4" />
              {isCreating ? "Creating..." : "New Terminal"}
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={isCreatingNote}
              variant="secondary"
              className={`gap-2 rounded-xl border border-border/60 bg-secondary/60 text-muted-foreground transition-all hover:text-foreground ${
                isMobile ? "h-11 w-full text-sm" : "h-10 px-5 text-sm"
              }`}
            >
              <StickyNote className="h-4 w-4" />
              {isCreatingNote ? "Creating..." : "New Note"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

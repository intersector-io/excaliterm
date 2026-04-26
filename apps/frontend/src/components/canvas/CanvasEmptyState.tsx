import { toast } from "sonner";
import { Terminal, StickyNote, Server, ArrowRight, Zap, Sparkles } from "lucide-react";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useServices } from "@/hooks/use-services";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { useSetupAgentStore } from "@/stores/setup-agent-store";
import { logWizardEvent } from "@/lib/wizard-telemetry";

function NoHostActions({
  isMobile,
  isCreatingNote,
  onConnect,
  onCreateNote,
}: Readonly<{
  isMobile: boolean;
  isCreatingNote: boolean;
  onConnect: () => void;
  onCreateNote: () => void;
}>) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Button
        onClick={onConnect}
        className={`gap-2 rounded-md border border-accent-cyan/20 bg-accent-cyan/10 text-accent-cyan transition-colors hover:bg-accent-cyan/16 ${
          isMobile ? "h-11 w-full text-sm" : "h-10 px-5 text-sm"
        }`}
      >
        <Server className="h-4 w-4" />
        Connect a host
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>

      <button
        onClick={onCreateNote}
        disabled={isCreatingNote}
        className="flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground"
      >
        <StickyNote className="h-3 w-3" />
        {isCreatingNote ? "Creating..." : "or add a note while you wait"}
      </button>

      <div
        className={`mt-2 w-full rounded-lg border border-border/50 bg-surface-raised/40 ${
          isMobile ? "px-4 py-3" : "px-5 py-4"
        }`}
      >
        <p className="text-caption font-medium text-muted-foreground/80">
          How it works
        </p>
        <ol className="mt-2 space-y-1.5 text-left">
          {[
            "Install the excaliterm package on your host",
            "Run the agent with your workspace credentials",
            "Create terminals on this canvas",
          ].map((step, i) => (
            <li
              key={step}
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
  );
}

function HasHostActions({
  isMobile,
  isCreating,
  onSetupAgent,
  onCreateTerminal,
}: Readonly<{
  isMobile: boolean;
  isCreating: boolean;
  onSetupAgent: () => void;
  onCreateTerminal: () => void;
}>) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <Button
        onClick={onSetupAgent}
        className={`gap-2 rounded-md border border-accent-amber/30 bg-accent-amber/[0.08] text-accent-amber transition-colors hover:border-accent-amber/50 hover:bg-accent-amber/15 ${
          isMobile ? "h-11 w-full text-sm" : "h-10 px-5 text-sm"
        }`}
      >
        <Sparkles className="h-4 w-4" />
        Set up your first agent
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
      <button
        onClick={onCreateTerminal}
        disabled={isCreating}
        className="flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground disabled:opacity-50"
      >
        <Terminal className="h-3 w-3" />
        {isCreating ? "Creating…" : "or create a blank terminal"}
      </button>
    </div>
  );
}

interface CanvasEmptyStateProps {
  onConnectHost: () => void;
}

export function CanvasEmptyState({
  onConnectHost,
}: Readonly<CanvasEmptyStateProps>) {
  const { createTerminal, isCreating } = useTerminals();
  const { createNote, isCreating: isCreatingNote } = useNotes();
  const { onlineCount } = useServices();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const openWizard = useSetupAgentStore((s) => s.openWizard);
  const wizardRecipe = useSetupAgentStore((s) => s.recipe);

  function handleSetupAgent() {
    logWizardEvent("wizard_opened", { recipe: wizardRecipe });
    openWizard();
  }

  const noHost = onlineCount === 0;

  async function handleCreateTerminal() {
    if (noHost) {
      toast.error("No host available", {
        description:
          "Connect a host before creating terminals.",
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
    <>
      <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto pointer-events-none">
        <div
          className={`pointer-events-auto flex flex-col items-center gap-5 text-center ${
            isMobile ? "px-6 py-8 max-w-[340px]" : "max-w-[480px] px-8"
          }`}
        >
          {/* Icon cluster */}
          <div className="relative">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-accent-cyan/15 bg-accent-cyan/[0.06]">
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
                ? "Connect a host to start creating terminal sessions on this canvas."
                : "Create terminal sessions and notes on this infinite canvas. Drag, resize, and collaborate in real time."}
            </p>
          </div>

          {/* Action area */}
          {noHost ? (
            <NoHostActions
              isMobile={isMobile}
              isCreatingNote={isCreatingNote}
              onConnect={onConnectHost}
              onCreateNote={handleCreateNote}
            />
          ) : (
            <HasHostActions
              isMobile={isMobile}
              isCreating={isCreating}
              onSetupAgent={handleSetupAgent}
              onCreateTerminal={handleCreateTerminal}
            />
          )}
        </div>
      </div>
    </>
  );
}

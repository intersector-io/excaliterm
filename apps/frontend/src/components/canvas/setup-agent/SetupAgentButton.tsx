import { Sparkles } from "lucide-react";
import { useSetupAgentStore } from "@/stores/setup-agent-store";
import { logWizardEvent } from "@/lib/wizard-telemetry";
import { SetupAgentWizard } from "./SetupAgentWizard";

export function SetupAgentButton() {
  const open = useSetupAgentStore((s) => s.open);
  const recipe = useSetupAgentStore((s) => s.recipe);
  const openWizard = useSetupAgentStore((s) => s.openWizard);

  function handleClick() {
    if (open) return;
    logWizardEvent("wizard_opened", { recipe });
    openWizard();
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-md border border-accent-amber/30 bg-accent-amber/[0.08] px-2 py-1 text-caption text-accent-amber transition-colors hover:border-accent-amber/50 hover:bg-accent-amber/15"
        title="Set up an agent (guided wizard)"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden md:inline">+ Set up an agent</span>
      </button>
      {open && <SetupAgentWizard />}
    </>
  );
}

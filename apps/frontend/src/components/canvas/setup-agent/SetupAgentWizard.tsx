import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/hooks/use-workspace";
import { useSetupAgentStore, type WizardStep } from "@/stores/setup-agent-store";
import { logWizardEvent } from "@/lib/wizard-telemetry";
import { rollbackArtifacts } from "./lib/rollback";
import { WizardStepper } from "./WizardStepper";
import { WizardLeftRail } from "./WizardLeftRail";
import { StepRecipePicker } from "./steps/StepRecipePicker";
import { StepHost } from "./steps/StepHost";
import { StepIdentity } from "./steps/StepIdentity";
import { StepGenerate } from "./steps/StepGenerate";
import { StepVerify } from "./steps/StepVerify";
import { StepCheckpoint } from "./steps/StepCheckpoint";

const ORDER: WizardStep[] = [
  "picker",
  "host",
  "identity",
  "generate",
  "verify",
  "checkpoint",
];

function nextStep(s: WizardStep): WizardStep | null {
  const i = ORDER.indexOf(s);
  return i < ORDER.length - 1 ? ORDER[i + 1] ?? null : null;
}

function prevStep(s: WizardStep): WizardStep | null {
  const i = ORDER.indexOf(s);
  return i > 0 ? ORDER[i - 1] ?? null : null;
}

export function SetupAgentWizard() {
  const open = useSetupAgentStore((s) => s.open);
  const step = useSetupAgentStore((s) => s.step);
  const recipe = useSetupAgentStore((s) => s.recipe);
  const hostId = useSetupAgentStore((s) => s.hostId);
  const identity = useSetupAgentStore((s) => s.identity);
  const generatePhase = useSetupAgentStore((s) => s.generatePhase);
  const artifacts = useSetupAgentStore((s) => s.artifacts);
  const setStep = useSetupAgentStore((s) => s.setStep);
  const reset = useSetupAgentStore((s) => s.reset);

  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const [closeConfirm, setCloseConfirm] = useState(false);

  const hasArtifacts = !!(
    artifacts.workerTerminalId ||
    artifacts.shellTerminalId ||
    artifacts.workerTriggerId ||
    artifacts.shellTriggerId
  );

  function tryClose() {
    if (hasArtifacts && step !== "checkpoint") {
      setCloseConfirm(true);
      return;
    }
    logWizardEvent("step_abandoned", { step });
    reset();
  }

  async function handleKeep() {
    setCloseConfirm(false);
    reset();
  }

  async function handleRollbackClose() {
    await rollbackArtifacts({ workspaceId, reason: "user", queryClient });
    logWizardEvent("rolled_back", { reason: "user", atStep: step });
    setCloseConfirm(false);
    reset();
  }

  function continueDisabled(): boolean {
    if (step === "host") return !hostId;
    if (step === "identity") {
      const w = identity.workerName.trim();
      const s = identity.shellName.trim();
      if (!w || !s || w === s) return true;
      if (
        identity.workerCli === "custom" &&
        !identity.workerCustomCommand.trim()
      ) {
        // Allow custom-with-empty-command — orchestrator skips launch.
      }
      return false;
    }
    if (step === "generate") return generatePhase !== "done";
    if (step === "verify") {
      const v = useSetupAgentStore.getState().verify.phase;
      return v !== "done" && v !== "skipped";
    }
    return false;
  }

  function handleContinue() {
    const n = nextStep(step);
    if (!n) return;
    logWizardEvent("step_advanced", { from: step, to: n });
    setStep(n);
  }

  function handleBack() {
    const p = prevStep(step);
    if (!p) return;
    setStep(p);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) tryClose();
      }}
    >
      <DialogContent className="!max-w-2xl gap-0 p-0 overflow-hidden">
        <div className="relative">
          <WizardLeftRail current={step} />

          <div className="border-b border-border-subtle/60 px-5 py-3.5 pl-7">
            <DialogTitle className="font-mono text-caption uppercase tracking-[0.18em] text-white/55">
              ◆ set up an agent <span className="text-white/30">/</span>{" "}
              <span className="text-foreground/80">
                {recipe === "coding-agent-with-sidecar-shell"
                  ? "coding agent + sidecar shell"
                  : recipe}
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Stepped wizard for connecting an agent.
            </DialogDescription>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-5 py-5 pl-7">
            {step === "picker" && <StepRecipePicker />}
            {step === "host" && <StepHost />}
            {step === "identity" && <StepIdentity />}
            {step === "generate" && <StepGenerate />}
            {step === "verify" && <StepVerify />}
            {step === "checkpoint" && <StepCheckpoint />}
          </div>

          <WizardStepper current={step} />

          {step !== "checkpoint" && (
            <div className="flex items-center justify-between border-t border-border-subtle/60 px-5 py-3 pl-7">
              <button
                onClick={handleBack}
                disabled={step === "picker"}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-body-sm text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>

              {step !== "generate" && step !== "verify" && (
                <button
                  onClick={handleContinue}
                  disabled={continueDisabled()}
                  className="flex items-center gap-1.5 rounded-md border border-accent-amber/40 bg-accent-amber/15 px-3 py-1.5 font-mono text-body-sm text-accent-amber transition-all hover:bg-accent-amber/20 disabled:opacity-40"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

      </DialogContent>

      <Dialog open={closeConfirm} onOpenChange={(o) => !o && setCloseConfirm(false)}>
        <DialogContent className="!max-w-md gap-0 p-5">
          <DialogTitle className="sr-only">Close the wizard?</DialogTitle>
          <DialogDescription className="sr-only">
            Choose to keep or roll back partially-created artifacts.
          </DialogDescription>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent-amber/30 bg-accent-amber/[0.08] text-accent-amber">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-body-sm font-medium text-foreground">
                Keep the terminals you&apos;ve already created?
              </p>
              <p className="mt-1 text-caption text-muted-foreground">
                The wizard already spawned canvas nodes for you. You can
                keep them and finish manually, or roll everything back.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => void handleRollbackClose()}
              className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-body-sm text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            >
              Roll back
            </button>
            <button
              onClick={() => void handleKeep()}
              className="rounded-md border border-accent-amber/40 bg-accent-amber/15 px-3 py-1.5 font-mono text-body-sm text-accent-amber hover:bg-accent-amber/20"
            >
              Keep
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

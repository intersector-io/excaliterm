import { Check } from "lucide-react";
import type { WizardStep } from "@/stores/setup-agent-store";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "picker", label: "00 recipe" },
  { id: "host", label: "01 host" },
  { id: "identity", label: "02 identity" },
  { id: "generate", label: "03 generate" },
  { id: "verify", label: "04 verify" },
  { id: "checkpoint", label: "05 done" },
];

interface WizardStepperProps {
  current: WizardStep;
}

export function WizardStepper({ current }: WizardStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="flex flex-col gap-1.5 border-t border-border-subtle/60 px-5 py-3">
      <div className="flex items-center gap-2 font-mono text-caption">
        {STEPS.map((step, i) => {
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          const color = isActive
            ? "text-foreground/90"
            : isDone
              ? "text-accent-green"
              : "text-white/30";
          return (
            <div key={step.id} className="flex items-center gap-2">
              <span className={`flex items-center gap-1 ${color}`}>
                {isDone && <Check className="h-3 w-3" />}
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="text-white/15">·</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="relative h-px overflow-hidden bg-white/[0.04]">
        <div
          className="absolute inset-y-0 left-0 bg-accent-amber/35 transition-[width] duration-500"
          style={{
            width: `${((currentIndex + 1) / STEPS.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

import { Check, X } from "lucide-react";
import type { BuildStepState } from "@/stores/setup-agent-store";

function StatusPip({ status }: { status: BuildStepState["status"] }) {
  if (status === "ok") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-accent-green/30 bg-accent-green/10 text-accent-green">
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-accent-red/40 bg-accent-red/10 text-accent-red">
        <X className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-accent-amber/40">
        <span className="h-2 w-2 rounded-full bg-accent-amber animate-pulse" />
      </span>
    );
  }
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-white/15 text-white/30">
      <span className="text-caption leading-none">☐</span>
    </span>
  );
}

interface BuildChecklistProps {
  steps: BuildStepState[];
}

export function BuildChecklist({ steps }: BuildChecklistProps) {
  return (
    <ol className="flex flex-col gap-1 rounded-md border border-border-subtle/60 bg-surface-sunken px-3 py-2.5">
      {steps.map((step) => (
        <li
          key={step.id}
          className={`flex items-center gap-3 px-1 py-1 font-mono text-caption transition-colors ${
            step.status === "running" ? "animate-shimmer rounded-sm" : ""
          }`}
        >
          <StatusPip status={step.status} />
          <span
            className={`flex-1 ${
              step.status === "ok"
                ? "text-foreground/80"
                : step.status === "failed"
                  ? "text-accent-red/90"
                  : step.status === "running"
                    ? "text-foreground/70"
                    : "text-white/40"
            }`}
          >
            {step.label}
          </span>
          {step.error && (
            <span className="text-caption text-accent-red/80">{step.error}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

import type { WizardStep } from "@/stores/setup-agent-store";

const POSITIONS: Record<WizardStep, string> = {
  picker: "8%",
  host: "24%",
  identity: "40%",
  generate: "56%",
  verify: "72%",
  checkpoint: "88%",
};

export function WizardLeftRail({ current }: { current: WizardStep }) {
  return (
    <div className="absolute left-0 top-0 bottom-0 w-px bg-border-default/60">
      <div
        className="absolute left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-accent-amber terminal-glow-locked transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ top: POSITIONS[current] }}
      />
    </div>
  );
}

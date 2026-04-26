import { useSetupAgentStore } from "@/stores/setup-agent-store";
import { RECIPE_CATALOG } from "../recipes/sidecar";
import type { RecipeId } from "../recipes/types";

function TopologyIcon({ kind }: { kind: "single" | "paired" | "single-with-trigger" }) {
  if (kind === "paired") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-16 text-accent-amber/60">
        <rect x="2" y="6" width="22" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <rect x="40" y="6" width="22" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="13" y1="20" x2="13" y2="28" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="51" y1="20" x2="51" y2="28" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx="13" cy="29" r="1.5" fill="currentColor" />
        <circle cx="51" cy="29" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "single-with-trigger") {
    return (
      <svg viewBox="0 0 64 32" className="h-8 w-16 text-white/30">
        <rect x="20" y="6" width="24" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="32" y1="20" x2="32" y2="28" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx="32" cy="29" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 32" className="h-8 w-16 text-white/30">
      <rect x="20" y="9" width="24" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}

export function StepRecipePicker() {
  const recipe = useSetupAgentStore((s) => s.recipe);
  const setRecipe = useSetupAgentStore((s) => s.setRecipe);

  function handlePick(id: RecipeId) {
    setRecipe(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-h1 font-semibold tracking-tight">What are you setting up?</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Pick a goal. We'll spawn the terminals, attach the triggers, and hand you the supervisor's MCP config.
        </p>
      </div>

      <div className="grid gap-2">
        {RECIPE_CATALOG.map((r) => {
          const selected = r.id === recipe;
          const disabled = r.id !== "coding-agent-with-sidecar-shell";
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => !disabled && handlePick(r.id)}
              disabled={disabled}
              className={`group flex items-center gap-4 rounded-lg border px-4 py-3 text-left transition-all ${
                selected
                  ? "border-accent-amber/60 bg-accent-amber/[0.06] ring-1 ring-accent-amber/20"
                  : "border-border-subtle/60 bg-card hover:border-border-default"
              } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
            >
              <div className="shrink-0 rounded-md border border-border-subtle/60 bg-surface-sunken px-2 py-1.5">
                <TopologyIcon kind={r.topology} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-body-sm font-semibold text-foreground/90">
                    {r.title}
                  </span>
                  {r.badge === "recommended" && (
                    <span className="rounded-full border border-accent-amber/30 bg-accent-amber/10 px-1.5 text-caption uppercase tracking-[0.18em] text-accent-amber">
                      recommended
                    </span>
                  )}
                  {disabled && (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-1.5 text-caption uppercase tracking-[0.18em] text-white/40">
                      soon
                    </span>
                  )}
                </div>
                <p className="mt-1 text-body-sm leading-relaxed text-muted-foreground">
                  {r.tagline}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

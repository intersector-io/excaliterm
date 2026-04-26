export type WizardEvent =
  | { name: "wizard_opened"; props: { recipe: string } }
  | { name: "step_advanced"; props: { from: string; to: string } }
  | { name: "step_abandoned"; props: { step: string } }
  | { name: "recipe_built"; props: { recipe: string; durationMs: number } }
  | { name: "verification_succeeded"; props: Record<string, never> }
  | { name: "verification_skipped"; props: Record<string, never> }
  | { name: "verification_failed"; props: { reason?: string } }
  | { name: "rolled_back"; props: { reason: "auto" | "user"; atStep: string } }
  | { name: "done_clicked"; props: Record<string, never> };

export function logWizardEvent<E extends WizardEvent>(
  name: E["name"],
  props: E["props"],
): void {
  if (typeof console !== "undefined" && console.debug) {
    console.debug(`[wizard] ${name}`, props);
  }
}

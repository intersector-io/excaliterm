import type { RecipeSummary } from "./types";

export const SIDECAR_RECIPE: RecipeSummary = {
  id: "coding-agent-with-sidecar-shell",
  title: "Coding agent + sidecar shell",
  tagline:
    "Drive a coding-agent CLI from your supervisor and pair it with a plain shell on the same host for recon.",
  badge: "recommended",
  topology: "paired",
};

export const RECIPE_CATALOG: RecipeSummary[] = [
  SIDECAR_RECIPE,
  {
    id: "watch-a-worker",
    title: "Watch a long-running agent",
    tagline:
      "Read-only supervision. Tell us when the worker stalls or starts emitting errors.",
    topology: "single",
  },
  {
    id: "babysit-a-dev-server",
    title: "Babysit a dev server",
    tagline: "Restart on cache corruption, hung HMR, or noisy stack traces.",
    topology: "single-with-trigger",
  },
];

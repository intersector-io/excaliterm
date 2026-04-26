import { create } from "zustand";
import {
  DEFAULT_IDENTITY,
  type RecipeId,
  type SidecarIdentity,
} from "@/components/canvas/setup-agent/recipes/types";

export type WizardStep =
  | "picker"
  | "host"
  | "identity"
  | "generate"
  | "verify"
  | "checkpoint";

export type BuildStepId =
  | "spawn-worker"
  | "spawn-shell"
  | "trigger-worker"
  | "trigger-shell"
  | "enable-triggers"
  | "launch-cli";

export type BuildStepStatus = "pending" | "running" | "ok" | "failed";

export interface BuildStepState {
  id: BuildStepId;
  label: string;
  status: BuildStepStatus;
  error?: string;
}

export interface CreatedArtifacts {
  workerTerminalId?: string;
  workerNodeId?: string;
  workerReadToken?: string;
  shellTerminalId?: string;
  shellNodeId?: string;
  shellReadToken?: string;
  workerTriggerId?: string;
  workerTriggerSecret?: string;
  shellTriggerId?: string;
  shellTriggerSecret?: string;
}

export type GeneratePhase = "preview" | "building" | "done" | "failed";

export type VerifyPhase =
  | "idle"
  | "firing"
  | "reading"
  | "done"
  | "failed"
  | "skipped";

export interface VerifyResult {
  phase: VerifyPhase;
  outputLines?: string[];
  errorMessage?: string;
}

const INITIAL_BUILD_STEPS: BuildStepState[] = [
  { id: "spawn-worker", label: "spawn terminal      worker", status: "pending" },
  { id: "spawn-shell", label: "spawn terminal      shell", status: "pending" },
  { id: "trigger-worker", label: "attach http trigger worker", status: "pending" },
  { id: "trigger-shell", label: "attach http trigger shell", status: "pending" },
  { id: "enable-triggers", label: "enable triggers", status: "pending" },
  { id: "launch-cli", label: "launch worker cli", status: "pending" },
];

interface SetupAgentStore {
  open: boolean;
  recipe: RecipeId;
  step: WizardStep;
  hostId: string | null;
  identity: SidecarIdentity;

  buildSteps: BuildStepState[];
  generatePhase: GeneratePhase;
  artifacts: CreatedArtifacts;
  justSpawned: Set<string>;
  reverseSpawning: Set<string>;

  verify: VerifyResult;

  // actions
  openWizard: () => void;
  closeWizard: () => void;
  setStep: (step: WizardStep) => void;
  setRecipe: (recipe: RecipeId) => void;
  setHostId: (id: string | null) => void;
  patchIdentity: (patch: Partial<SidecarIdentity>) => void;

  setGeneratePhase: (phase: GeneratePhase) => void;
  setBuildStep: (id: BuildStepId, patch: Partial<BuildStepState>) => void;
  resetBuildSteps: () => void;
  patchArtifacts: (patch: Partial<CreatedArtifacts>) => void;

  markSpawned: (nodeId: string) => void;
  clearSpawned: (nodeId: string) => void;
  beginReverseSpawn: (nodeIds: string[]) => void;
  endReverseSpawn: (nodeId: string) => void;

  setVerify: (patch: Partial<VerifyResult>) => void;

  reset: () => void;
}

export const useSetupAgentStore = create<SetupAgentStore>((set) => ({
  open: false,
  recipe: "coding-agent-with-sidecar-shell",
  step: "picker",
  hostId: null,
  identity: { ...DEFAULT_IDENTITY },

  buildSteps: INITIAL_BUILD_STEPS.map((s) => ({ ...s })),
  generatePhase: "preview",
  artifacts: {},
  justSpawned: new Set(),
  reverseSpawning: new Set(),

  verify: { phase: "idle" },

  openWizard: () => set({ open: true, step: "picker" }),
  closeWizard: () => set({ open: false }),
  setStep: (step) => set({ step }),
  setRecipe: (recipe) => set({ recipe }),
  setHostId: (hostId) => set({ hostId }),
  patchIdentity: (patch) =>
    set((s) => ({ identity: { ...s.identity, ...patch } })),

  setGeneratePhase: (generatePhase) => set({ generatePhase }),
  setBuildStep: (id, patch) =>
    set((s) => ({
      buildSteps: s.buildSteps.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      ),
    })),
  resetBuildSteps: () =>
    set({ buildSteps: INITIAL_BUILD_STEPS.map((s) => ({ ...s })) }),
  patchArtifacts: (patch) =>
    set((s) => ({ artifacts: { ...s.artifacts, ...patch } })),

  markSpawned: (nodeId) =>
    set((s) => {
      const next = new Set(s.justSpawned);
      next.add(nodeId);
      return { justSpawned: next };
    }),
  clearSpawned: (nodeId) =>
    set((s) => {
      if (!s.justSpawned.has(nodeId)) return s;
      const next = new Set(s.justSpawned);
      next.delete(nodeId);
      return { justSpawned: next };
    }),
  beginReverseSpawn: (nodeIds) =>
    set((s) => {
      const next = new Set(s.reverseSpawning);
      for (const id of nodeIds) next.add(id);
      return { reverseSpawning: next };
    }),
  endReverseSpawn: (nodeId) =>
    set((s) => {
      if (!s.reverseSpawning.has(nodeId)) return s;
      const next = new Set(s.reverseSpawning);
      next.delete(nodeId);
      return { reverseSpawning: next };
    }),

  setVerify: (patch) => set((s) => ({ verify: { ...s.verify, ...patch } })),

  reset: () =>
    set({
      open: false,
      step: "picker",
      hostId: null,
      identity: { ...DEFAULT_IDENTITY },
      buildSteps: INITIAL_BUILD_STEPS.map((s) => ({ ...s })),
      generatePhase: "preview",
      artifacts: {},
      justSpawned: new Set(),
      reverseSpawning: new Set(),
      verify: { phase: "idle" },
    }),
}));

export function selectArtifactNodeIds(s: SetupAgentStore): string[] {
  const ids: string[] = [];
  if (s.artifacts.workerNodeId) ids.push(s.artifacts.workerNodeId);
  if (s.artifacts.shellNodeId) ids.push(s.artifacts.shellNodeId);
  return ids;
}

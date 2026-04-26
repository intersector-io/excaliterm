import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WORKSPACE_STORAGE_KEY = "excaliterm.workspace-id";

// The workspace apiKey is returned only once — on POST /api/workspaces. The
// browser that created the workspace keeps it here so the agent-connect UI can
// still show the CLI command. Other browsers visiting the workspace URL will
// not have it, which is intentional: apiKeys must not be fetched by anyone who
// merely knows a workspace ID.
export function workspaceApiKeyStorageKey(workspaceId: string): string {
  return `excaliterm.workspace-api-key.${workspaceId}`;
}

export function sanitizeIdentifier(input: string): string {
  return input.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

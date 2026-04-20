import { createContext, useContext } from "react";
import type { CollaboratorProfile } from "@/lib/collaborator";

export interface WorkspaceContext {
  workspaceId: string;
  collaborator: CollaboratorProfile;
}

export const WorkspaceCtx = createContext<WorkspaceContext | null>(null);

export function useWorkspace(): WorkspaceContext {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

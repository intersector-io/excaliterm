import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { createWorkspace } from "@/lib/api-client";
import { WORKSPACE_STORAGE_KEY, workspaceApiKeyStorageKey } from "@/lib/utils";

export function useCreateWorkspace(onBeforeNavigate?: () => void) {
  const [, navigate] = useLocation();
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const ws = await createWorkspace();
      globalThis.localStorage.setItem(WORKSPACE_STORAGE_KEY, ws.id);
      globalThis.localStorage.setItem(
        workspaceApiKeyStorageKey(ws.id),
        ws.apiKey,
      );
      onBeforeNavigate?.();
      navigate(`/w/${ws.id}`, { replace: true });
    } catch {
      toast.error("Failed to create workspace");
      setCreating(false);
    }
  }

  return { create, creating };
}

import { useEffect, useMemo, useState } from "react";
import { Route, Switch, useParams } from "wouter";
import { Toaster } from "sonner";
import { WorkspaceCtx } from "@/hooks/use-workspace";
import { getWorkspace } from "@/lib/api-client";
import { initHubs } from "@/lib/signalr-client";
import { getOrCreateCollaboratorProfile } from "@/lib/collaborator";
import { WORKSPACE_STORAGE_KEY } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { LandingPage } from "@/components/LandingPage";

function WorkspaceRoute() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId!;
  const [valid, setValid] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const collaborator = useMemo(() => getOrCreateCollaboratorProfile(), []);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    getWorkspace(workspaceId)
      .then((ws) => {
        globalThis.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
        setApiKey(ws.apiKey ?? "");
        setValid(true);
      })
      .catch(() => setValid(false));
  }, [workspaceId]);

  const ctxValue = useMemo(
    () => ({ workspaceId, apiKey, collaborator }),
    [workspaceId, apiKey, collaborator],
  );

  if (valid === null) {
    return (
      <div className="flex min-h-[100dvh] w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent-cyan" />
          </div>
          <p className="text-sm text-muted-foreground font-mono tracking-tight">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  // Initialize hubs synchronously before children mount
  // This must happen before AppShell renders so hooks can access hubs
  if (valid) {
    initHubs(workspaceId, collaborator);
  }

  if (!valid) {
    return (
      <div className="flex min-h-[100dvh] w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 text-center px-4">
          <div className="flex flex-col items-center gap-2">
            <span className="text-6xl font-bold tracking-tighter text-foreground/20">404</span>
            <p className="text-base font-medium text-foreground">
              Workspace not found
            </p>
            <p className="text-sm text-muted-foreground max-w-[40ch] leading-relaxed">
              This workspace doesn't exist or may have expired.
              Create a fresh one to get started.
            </p>
          </div>
          <a
            href="/"
            className="inline-flex h-9 items-center rounded-lg bg-accent-cyan/15 px-4 text-sm font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/25"
          >
            Create new workspace
          </a>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceCtx.Provider value={ctxValue}>
      <AppShell />
    </WorkspaceCtx.Provider>
  );
}

export function App() {
  return (
    <>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "oklch(0.16 0.008 270)",
            border: "1px solid oklch(0.24 0.008 270)",
            color: "oklch(0.95 0.005 270)",
            fontFamily: "'Outfit', sans-serif",
            fontSize: "13px",
          },
        }}
        offset={16}
        gap={8}
      />
      <Switch>
        <Route path="/w/:workspaceId" component={WorkspaceRoute} />
        <Route path="/" component={LandingPage} />
        <Route>
          <div className="flex min-h-[100dvh] w-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="text-6xl font-bold tracking-tighter text-foreground/20">404</span>
              <p className="text-sm text-muted-foreground">Page not found</p>
              <a
                href="/"
                className="text-sm text-accent-cyan hover:underline underline-offset-4"
              >
                Go home
              </a>
            </div>
          </div>
        </Route>
      </Switch>
    </>
  );
}

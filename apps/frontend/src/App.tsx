import { useEffect, useMemo, useState } from "react";
import { Route, Switch, useParams } from "wouter";
import { Toaster } from "sonner";
import { WorkspaceCtx } from "@/hooks/use-workspace";
import { getWorkspace } from "@/lib/api-client";
import { initHubs } from "@/lib/signalr-client";
import { getOrCreateCollaboratorProfile } from "@/lib/collaborator";
import { WORKSPACE_STORAGE_KEY, workspaceApiKeyStorageKey } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { LandingPage } from "@/components/LandingPage";

function WorkspaceRoute() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId!;
  const [valid, setValid] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [collaborator, setCollaborator] = useState(() => getOrCreateCollaboratorProfile());

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    getWorkspace(workspaceId)
      .then(() => {
        globalThis.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
        // apiKey is only known to the browser that created the workspace (it is
        // returned just once on POST /api/workspaces and stashed in localStorage).
        // Browsers that arrive via a shared link will not have it, and the
        // connect-host UI will show "(copy from the browser that created it)".
        const storedKey = globalThis.localStorage.getItem(
          workspaceApiKeyStorageKey(workspaceId),
        );
        setApiKey(storedKey ?? "");
        setValid(true);
      })
      .catch(() => setValid(false));
  }, [workspaceId]);

  const ctxValue = useMemo(
    () => ({ workspaceId, apiKey, collaborator, setCollaborator }),
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
    return <NotFoundPage heading="Workspace not found" subheading="This workspace doesn't exist or may have expired." />;
  }

  return (
    <WorkspaceCtx.Provider value={ctxValue}>
      <AppShell />
    </WorkspaceCtx.Provider>
  );
}

function NotFoundPage({ heading, subheading }: { heading: string; subheading: string }) {
  return (
    <div className="flex min-h-[100dvh] w-screen items-center justify-center bg-background px-6">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border-subtle bg-card/60 p-8 text-center">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.25_0.06_290),transparent_70%)]" />
        <span className="block text-6xl font-bold tracking-tighter text-foreground/20">404</span>
        <p className="mt-2 text-base font-medium text-foreground">{heading}</p>
        <p className="mx-auto mt-1 max-w-[40ch] text-sm leading-relaxed text-muted-foreground">{subheading}</p>
        <div className="my-6 h-px bg-border-subtle" />
        <p className="text-caption uppercase tracking-wider text-muted-foreground">Excaliterm</p>
        <p className="mt-1 text-body-sm leading-relaxed text-foreground">
          Pair on any terminal, any machine — in the browser.
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          No account. Shareable link in 2 seconds.
        </p>
        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <a
            href="/"
            className="inline-flex h-10 items-center rounded-lg bg-accent-cyan px-4 text-sm font-semibold text-background transition-all hover:brightness-110"
          >
            Create a workspace — free
          </a>
          <a
            href="https://github.com/intersector-io/excaliterm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-border-default bg-surface-raised/40 px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
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
          <NotFoundPage heading="Page not found" subheading="That URL doesn't exist here." />
        </Route>
      </Switch>
    </>
  );
}

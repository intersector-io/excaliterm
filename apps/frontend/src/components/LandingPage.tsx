import { useState } from "react";
import { useLocation } from "wouter";
import { Terminal, Users, Layout, MessageSquare, MonitorUp, ArrowRight } from "lucide-react";
import { createWorkspace } from "@/lib/api-client";
import { WORKSPACE_STORAGE_KEY } from "@/lib/utils";

export function LandingPage() {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);

  function handleStart() {
    setLoading(true);
    const savedId = globalThis.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (savedId) {
      navigate(`/w/${savedId}`, { replace: true });
      return;
    }
    createWorkspace()
      .then((ws) => {
        globalThis.localStorage.setItem(WORKSPACE_STORAGE_KEY, ws.id);
        navigate(`/w/${ws.id}`, { replace: true });
      })
      .catch(() => setLoading(false));
  }

  function StartButton({ className }: { className?: string }) {
    return (
      <button
        onClick={handleStart}
        disabled={loading}
        className={`inline-flex h-11 items-center gap-2 rounded-lg bg-accent-cyan px-6 text-body font-semibold text-background shadow-[0_0_24px_oklch(0.68_0.09_200/0.25)] transition-all hover:brightness-110 disabled:opacity-60 ${className ?? ""}`}
      >
        {loading ? "Creating workspace..." : "Start a workspace"}
        {!loading && <ArrowRight className="size-4" />}
      </button>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.25_0.06_290),transparent_70%)]" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-20 text-center sm:pt-28 sm:pb-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised/60 px-4 py-1.5 text-caption text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
            Open source &middot; Self-hostable &middot; No accounts
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Collaborative terminals on an{" "}
            <span className="text-accent-cyan">infinite canvas</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Share live terminal sessions, sticky notes, and code editors with
            anyone. Connect any machine, drag terminals around, collaborate in
            real time.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <StartButton />
            <a
              href="https://github.com/intersector-io/excaliterm"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-default bg-surface-raised/40 px-6 text-body font-medium text-foreground transition-colors hover:bg-surface-raised"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6">
        <div className="overflow-hidden rounded-xl border border-border-subtle shadow-[0_16px_64px_rgba(0,0,0,0.4)]">
          <img
            src="/screenshots/hero-canvas.png"
            alt="Excaliterm workspace with a connected host, two live terminals showing docker containers and git history, and a sticky note on an infinite canvas"
            className="w-full"
            loading="lazy"
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-24">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Everything you need for shared terminal workflows
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Install the CLI on any machine, connect it to your workspace, and
          start collaborating instantly.
        </p>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Terminal />}
            title="Live terminals"
            description="Full PTY sessions streamed in real time. Resize, scroll, and type from any browser."
          />
          <FeatureCard
            icon={<Layout />}
            title="Infinite canvas"
            description="Drag terminals, sticky notes, and code editors anywhere. Zoom in and out, organize by tags."
          />
          <FeatureCard
            icon={<Users />}
            title="Real-time collaboration"
            description="Share the workspace URL with anyone. They join instantly with no accounts needed."
          />
          <FeatureCard
            icon={<MonitorUp />}
            title="Screen sharing"
            description="Stream any monitor from a connected host directly onto the canvas at ~3fps."
          />
          <FeatureCard
            icon={<MessageSquare />}
            title="Built-in chat"
            description="Discuss and coordinate alongside your terminals without switching context."
          />
          <FeatureCard
            icon={<TerminalPromptIcon />}
            title="One CLI command"
            description="npm install -g excaliterm, set your workspace ID, and your machine is connected."
          />
        </div>
      </section>

      <section className="border-t border-border-subtle bg-surface-sunken/40 py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Up and running in under a minute
          </h2>
          <ol className="mt-12 space-y-8">
            <Step n={1} title="Create a workspace">
              Click "Start a workspace" above. A unique canvas URL is generated
              instantly.
            </Step>
            <Step n={2} title="Connect a host">
              Install the CLI with <code className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-body-sm text-accent-cyan">npm install -g excaliterm</code> and
              paste the connection command from the UI.
            </Step>
            <Step n={3} title="Collaborate">
              Share the URL. Everyone sees the same canvas, terminals, and chat
              in real time.
            </Step>
          </ol>
        </div>
      </section>

      <section className="py-24 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to try it?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Free and open source. Self-host it or use the hosted version.
        </p>
        <StartButton className="mt-8" />
      </section>

      <footer className="border-t border-border-subtle py-8 text-center text-caption text-muted-foreground">
        <p>Excaliterm &middot; MIT License &middot; <a href="https://github.com/intersector-io/excaliterm" target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline underline-offset-2">GitHub</a></p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card/60 p-6 transition-colors hover:border-border-default">
      <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-accent-cyan/10 text-accent-cyan">
        {icon}
      </div>
      <h3 className="text-body font-semibold">{title}</h3>
      <p className="mt-1.5 text-body-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent-cyan/30 bg-accent-cyan/10 font-mono text-body-sm font-bold text-accent-cyan">
        {n}
      </span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-body-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function TerminalPromptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

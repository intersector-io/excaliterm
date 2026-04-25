import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Bug,
  GraduationCap,
  Siren,
  Bot,
  Check,
  X,
  Copy,
  Lock,
  History,
  FileCode,
  StickyNote,
  Server,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { createWorkspace } from "@/lib/api-client";
import { copyToClipboard } from "@/lib/clipboard";
import { WORKSPACE_STORAGE_KEY, workspaceApiKeyStorageKey } from "@/lib/utils";

const GITHUB_URL = "https://github.com/intersector-io/excaliterm";

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
        globalThis.localStorage.setItem(workspaceApiKeyStorageKey(ws.id), ws.apiKey);
        navigate(`/w/${ws.id}`, { replace: true });
      })
      .catch(() => setLoading(false));
  }

  function PrimaryCTA({ className }: { className?: string }) {
    return (
      <button
        onClick={handleStart}
        disabled={loading}
        className={`inline-flex h-11 items-center gap-2 rounded-lg bg-accent-cyan px-6 text-body font-semibold text-background shadow-[0_0_24px_oklch(0.68_0.09_200/0.25)] transition-all hover:brightness-110 disabled:opacity-60 ${className ?? ""}`}
      >
        {loading ? "Creating workspace..." : "Create a workspace — free"}
        {!loading && <ArrowRight className="size-4" />}
      </button>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.25_0.06_290),transparent_70%)]" />
        <div className="relative mx-auto max-w-5xl px-6 pb-16 pt-20 text-center sm:pt-28 sm:pb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised/60 px-4 py-1.5 text-caption text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
            MIT licensed &middot; Self-host in one Docker command &middot; No sign-up
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Pair on any terminal,{" "}
            <span className="text-accent-cyan">any machine</span>
            {" "}— in the browser.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Share a link. Teammates see the same live shells, files, and sticky
            notes on an infinite canvas. No accounts, no SSH gymnastics, no
            screen-sharing your whole desktop.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <PrimaryCTA />
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-default bg-surface-raised/40 px-6 text-body font-medium text-foreground transition-colors hover:bg-surface-raised"
            >
              View on GitHub
            </a>
          </div>
          <p className="mt-4 text-caption text-muted-foreground">
            No account. No credit card. Shareable link in 2 seconds.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 opacity-80">
            <img
              src="https://img.shields.io/github/stars/intersector-io/excaliterm?style=flat&logo=github&label=Star&color=22272e&labelColor=22272e"
              alt="GitHub stars"
              className="h-5"
              loading="lazy"
            />
            <img
              src="https://img.shields.io/npm/dw/excaliterm?logo=npm&label=weekly%20installs&color=22272e&labelColor=22272e"
              alt="npm weekly downloads"
              className="h-5"
              loading="lazy"
            />
            <img
              src="https://img.shields.io/badge/license-MIT-22272e"
              alt="MIT license"
              className="h-5"
              loading="lazy"
            />
            <img
              src="https://img.shields.io/badge/self--host-Docker-22272e?logo=docker"
              alt="Docker self-host"
              className="h-5"
              loading="lazy"
            />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-xl border border-border-subtle shadow-[0_16px_64px_rgba(0,0,0,0.4)]">
          <img
            src="/screenshots/hero-canvas.png"
            alt="Excaliterm workspace showing a connected host, live terminals, sticky notes, and a file editor on an infinite canvas"
            className="w-full"
          />
          <AnnotationDot className="left-[52%] top-[16%]" label="Connected host on another machine" side="right" />
          <AnnotationDot className="left-[68%] top-[50%]" label="Live shell streamed to everyone" side="left" />
          <AnnotationDot className="left-[30%] top-[78%]" label="Webhook fires a command on schedule" side="right" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pt-24">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Built for the moments you'd rather not screen-share
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Four jobs Excaliterm handles better than an ad-hoc Zoom + SSH dance.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <UseCaseCard
            icon={<Bug />}
            title="Pair debugging & on-call"
            body="Two engineers, one prod shell. Terminal locks keep you from fighting over the prompt; chat sits right next to the commands; screenshots pin evidence to the canvas."
          />
          <UseCaseCard
            icon={<GraduationCap />}
            title="Remote teaching & onboarding"
            body="Instructor types, learners watch live. Drop sticky notes with next steps, open a file editor alongside the shell, and let everyone join by URL — no install on their end."
          />
          <UseCaseCard
            icon={<Siren />}
            title="Incident war rooms"
            body="Put prod, staging, and your laptop on the same canvas. Stream a monitor from any host at ~3fps when you need to see the GUI, not just the shell."
          />
          <UseCaseCard
            icon={<Bot />}
            title="AI & agent dashboards"
            body="Connect long-running agents and Claude Code sessions as hosts — then schedule recurring checks or expose a webhook so external systems drive the shell directly. Watch them work, intervene when needed."
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pt-24">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          The whole shared terminal workflow, in one canvas
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Install the CLI on any machine, paste the connection command, start
          collaborating.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Everyone sees the same prompt"
            description="Full PTY sessions streamed in real time. No screen-share lag, no ‘can you scroll up?’ Everyone types in the same shell."
          />
          <FeatureCard
            title="One glance across every machine"
            description="Prod, staging, your laptop side-by-side on an infinite canvas. Drag, zoom, tag — organize terminals like windows."
          />
          <FeatureCard
            title="Automate from cron, CI, or a webhook"
            description="Attach a timer trigger to run a prompt every N minutes, or expose an HTTP webhook URL with a secret token. External systems POST to it; the prompt lands in the terminal as if you typed it."
          />
          <FeatureCard
            title="See the GUI, not just the shell"
            description="Stream any monitor from a connected host directly onto the canvas, or capture a one-shot screenshot tied to a terminal."
          />
          <FeatureCard
            title="Talk without leaving the shell"
            description="Built-in chat sits alongside your terminals. Decisions stay with the commands they describe — no Slack context-switching."
          />
          <FeatureCard
            title="One CLI command"
            description="npm install -g excaliterm, paste the pre-filled command, done. The machine is online and ready in under a minute."
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-body-sm text-muted-foreground">
          <Badge icon={<Lock className="size-3.5" />} label="Terminal locks" />
          <Badge icon={<History className="size-3.5" />} label="Persistent command history" />
          <Badge icon={<FileCode className="size-3.5" />} label="In-canvas file editor" />
          <Badge icon={<StickyNote className="size-3.5" />} label="Markdown sticky notes" />
          <Badge icon={<Zap className="size-3.5" />} label="Timer & HTTP triggers" />
          <Badge icon={<Server className="size-3.5" />} label="Docker self-host" />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 pt-24">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          How it compares
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Already use tmate or Live Share? Here's where Excaliterm fits.
        </p>

        <div className="mt-10 overflow-hidden rounded-xl border border-border-subtle bg-card/40">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-raised/40 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground"></th>
                <th className="px-4 py-3 font-medium text-muted-foreground">tmate / sshx</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">VS&nbsp;Code Live Share</th>
                <th className="px-4 py-3 font-semibold text-accent-cyan">Excaliterm</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow feature="Multiple hosts on one canvas" a={false} b={false} c />
              <CompareRow feature="No account for guests" a b={false} c />
              <CompareRow feature="Spatial canvas & notes" a={false} b={false} c />
              <CompareRow feature="Persistent workspace & history" a={false} b={false} c />
              <CompareRow feature="Built-in chat beside shells" a={false} b c />
              <CompareRow feature="Webhook automation into the shell" a={false} b={false} c />
              <CompareRow feature="Self-hostable (Docker)" a={false} b={false} c />
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-24 border-t border-border-subtle bg-surface-sunken/40 py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Up and running in under a minute
          </h2>
          <ol className="mt-12 space-y-8">
            <Step n={1} title="Create a workspace">
              Click <strong className="font-semibold text-foreground">Create a workspace</strong> above. A unique canvas URL is generated instantly.
            </Step>
            <Step n={2} title="Connect a host">
              Install the CLI, then paste the connection command from the UI (pre-filled with your workspace ID and API key).
              <CopyableCommand command="npm install -g excaliterm" className="mt-3" />
            </Step>
            <Step n={3} title="Collaborate">
              Share the URL. Everyone sees the same canvas, terminals, editor, and chat in real time.
            </Step>
          </ol>
        </div>
      </section>

      <section className="py-24 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Share a terminal in 30 seconds
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Free and open source. Self-host it or use the hosted version.
        </p>
        <PrimaryCTA className="mt-8" />
        <p className="mt-4 text-caption text-muted-foreground">
          Tip: works best if you've got a laptop shell handy — the host CLI doesn't run on phones.
        </p>
      </section>

      <footer className="border-t border-border-subtle bg-surface-sunken/30">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-14 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="text-body font-semibold">Excaliterm</p>
            <p className="mt-2 text-caption text-muted-foreground">
              Collaborative terminals on an infinite canvas. MIT licensed.
            </p>
          </div>
          <FooterCol
            title="Docs"
            links={[
              { label: "Feature guide", href: "https://github.com/intersector-io/excaliterm/tree/main/docs/features" },
              { label: "Architecture", href: "https://github.com/intersector-io/excaliterm/blob/main/docs/architecture.md" },
              { label: "API reference", href: "https://github.com/intersector-io/excaliterm/blob/main/docs/api-reference.md" },
            ]}
          />
          <FooterCol
            title="Self-host"
            links={[
              { label: "Setup", href: "https://github.com/intersector-io/excaliterm/blob/main/docs/setup.md" },
              { label: "Deployment", href: "https://github.com/intersector-io/excaliterm/blob/main/docs/deployment.md" },
              { label: "Windows service", href: "https://github.com/intersector-io/excaliterm/blob/main/docs/windows-service.md" },
            ]}
          />
          <FooterCol
            title="Project"
            links={[
              { label: "GitHub", href: GITHUB_URL },
              { label: "Issues", href: `${GITHUB_URL}/issues` },
              { label: "Releases", href: `${GITHUB_URL}/releases` },
            ]}
          />
        </div>
        <div className="border-t border-border-subtle py-6 text-center text-caption text-muted-foreground">
          Excaliterm &middot; MIT License &middot;{" "}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline underline-offset-2">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card/60 p-6 transition-colors hover:border-border-default">
      <h3 className="text-body font-semibold">{title}</h3>
      <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function UseCaseCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card/60 p-6 transition-colors hover:border-border-default">
      <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-accent-cyan/10 text-accent-cyan">
        {icon}
      </div>
      <h3 className="text-body font-semibold">{title}</h3>
      <p className="mt-1.5 text-body-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent-cyan/30 bg-accent-cyan/10 font-mono text-body-sm font-bold text-accent-cyan">
        {n}
      </span>
      <div className="flex-1">
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1 text-body-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-raised/40 px-3 py-1">
      <span className="text-accent-cyan">{icon}</span>
      {label}
    </span>
  );
}

function CompareRow({
  feature,
  a,
  b,
  c,
}: {
  feature: string;
  a: boolean;
  b: boolean;
  c: boolean;
}) {
  return (
    <tr className="border-b border-border-subtle/60 last:border-b-0">
      <td className="px-4 py-3 text-foreground">{feature}</td>
      <td className="px-4 py-3"><Cell on={a} /></td>
      <td className="px-4 py-3"><Cell on={b} /></td>
      <td className="px-4 py-3"><Cell on={c} accent /></td>
    </tr>
  );
}

function Cell({ on, accent }: { on: boolean; accent?: boolean }) {
  if (on) {
    return (
      <Check
        className={`size-4 ${accent ? "text-accent-cyan" : "text-accent-green"}`}
        strokeWidth={3}
      />
    );
  }
  return <X className="size-4 text-muted-foreground/50" strokeWidth={2.5} />;
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-body-sm font-semibold text-foreground">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-caption text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnnotationDot({
  className,
  label,
  side,
}: {
  className: string;
  label: string;
  side: "left" | "right";
}) {
  return (
    <div className={`pointer-events-none absolute hidden md:block ${className}`}>
      <span className="relative flex size-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cyan/60" />
        <span className="relative inline-flex size-3 rounded-full bg-accent-cyan shadow-[0_0_12px_oklch(0.68_0.09_200/0.8)]" />
      </span>
      <span
        className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border-subtle bg-surface-raised/95 px-2.5 py-1 text-caption font-medium text-foreground backdrop-blur ${
          side === "right" ? "left-5" : "right-5"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function CopyableCommand({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (timerRef.current !== null) globalThis.clearTimeout(timerRef.current);
  }, []);
  async function copy() {
    try {
      await copyToClipboard(command);
      setCopied(true);
      toast.success("Copied to clipboard");
      timerRef.current = globalThis.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  }
  return (
    <div className={`flex items-center gap-2 rounded-lg border border-border-subtle bg-background/80 px-3 py-2 font-mono text-body-sm ${className ?? ""}`}>
      <span className="text-accent-cyan">$</span>
      <code className="flex-1 text-foreground">{command}</code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
        aria-label="Copy command"
      >
        {copied ? <Check className="size-3.5 text-accent-green" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

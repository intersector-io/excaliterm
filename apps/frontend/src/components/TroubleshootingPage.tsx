import { ArrowLeft, AlertTriangle } from "lucide-react";

const GITHUB_DOCS_URL =
  "https://github.com/intersector-io/excaliterm/blob/main/docs/troubleshooting.md";
const ISSUES_URL = "https://github.com/intersector-io/excaliterm/issues";

export function TroubleshootingPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border-subtle bg-surface-sunken/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </a>
          <a
            href={GITHUB_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption text-muted-foreground transition-colors hover:text-foreground"
          >
            View on GitHub
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised/60 px-3 py-1 text-caption text-muted-foreground">
          <AlertTriangle className="size-3.5 text-accent-cyan" />
          CLI errors &amp; fixes
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Troubleshooting
        </h1>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-muted-foreground">
          Common errors when running <code className="font-mono text-foreground">excaliterm</code>,
          with likely causes ranked by frequency. If none of these solve your
          issue,{" "}
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-cyan hover:underline underline-offset-2"
          >
            open an issue
          </a>{" "}
          with the full CLI output.
        </p>

        <Section
          id="shell-self-test-failed"
          title="Shell self-test failed"
          symptom={`[terminal-agent] Shell self-test failed: cannot spawn "/bin/zsh" in cwd "/Users/<name>": posix_spawnp failed.
[terminal-agent] Refusing to start. Fix the shell/cwd above or pass --shell <path>.`}
        >
          <p>
            The agent runs a throwaway PTY at startup so it fails fast instead of
            breaking every terminal you create later. Work through these causes
            in order — the first one is the most common.
          </p>

          <Cause
            n={1}
            title="node-pty native binary mismatch (most common on Apple Silicon)"
          >
            <p>
              The prebuilt <code>node-pty</code> binary doesn't match your CPU.
              Usually happens when Node was installed under Rosetta on an arm64
              Mac.
            </p>
            <Code>{`node -e 'console.log(process.arch, process.platform)'
uname -m`}</Code>
            <p>
              If <code>process.arch</code> is <code>x64</code> but{" "}
              <code>uname -m</code> reports <code>arm64</code> (or vice versa),
              reinstall under the native arch:
            </p>
            <Code>{`arch -arm64 npm i -g excaliterm`}</Code>
          </Cause>

          <Cause n={2} title="cwd doesn't exist or isn't accessible">
            <p>
              The agent defaults to <code>$HOME</code>. If that path doesn't
              exist on this machine, the spawn fails.
            </p>
            <Code>{`echo $HOME
ls -ld "$HOME"`}</Code>
            <p>Workaround — pass an explicit cwd:</p>
            <Code>{`excaliterm --cwd "$(pwd)" ...`}</Code>
          </Cause>

          <Cause n={3} title="Shell not executable">
            <Code>{`ls -l /bin/zsh
/bin/zsh -c 'echo ok'`}</Code>
            <p>Workaround — use a different shell:</p>
            <Code>{`excaliterm --shell /bin/bash ...`}</Code>
          </Cause>

          <Cause n={4} title="macOS quarantine or MDM blocking spawn">
            <Code>{`xattr "$(which excaliterm)"
xattr -d com.apple.quarantine "$(which excaliterm)"`}</Code>
            <p>
              If running from a sandboxed location like{" "}
              <code>~/Downloads</code>, move the binary elsewhere
              (<code>/usr/local/bin</code>, <code>~/bin</code>).
            </p>
          </Cause>
        </Section>

        <Section
          id="cannot-reach-hub"
          title="Cannot reach hub"
          symptom={`[terminal-agent] Failed to connect: getaddrinfo ENOTFOUND hub.excaliterm.com`}
        >
          <Cause n={1} title="DNS or network">
            <Code>{`curl -I https://hub.excaliterm.com`}</Code>
            <p>If that fails, the issue is local network / DNS, not the agent.</p>
          </Cause>
          <Cause n={2} title="Corporate proxy blocking WebSockets">
            <p>
              SignalR needs a working WebSocket upgrade. Set{" "}
              <code>HTTPS_PROXY</code> / <code>HTTP_PROXY</code> and confirm the
              proxy supports WebSockets.
            </p>
          </Cause>
          <Cause n={3} title="Self-hosted hub URL wrong">
            <p>
              Check <code>--hub-url</code> matches your deployment. Use the hub
              origin only, no trailing path.
            </p>
          </Cause>
        </Section>

        <Section
          id="401-unauthorized"
          title="401 Unauthorized on connect"
          symptom={`[terminal-agent] Hub connection rejected: 401`}
        >
          <Cause n={1} title="API key revoked or wrong">
            <p>
              Copy the key fresh from the workspace UI. The key is shown once at
              workspace creation; if you've lost it, create a new workspace.
            </p>
          </Cause>
          <Cause n={2} title="API key belongs to a different workspace">
            <p>
              <code>--workspace-id</code> and <code>--api-key</code> must be
              from the same workspace.
            </p>
          </Cause>
          <Cause n={3} title="Clock skew">
            <p>
              If the host clock is off by several minutes, signed requests
              fail. Sync NTP.
            </p>
          </Cause>
        </Section>

        <Section
          id="workspace-not-found"
          title="Workspace not found"
          symptom={`[terminal-agent] Workspace "<id>" does not exist`}
        >
          <p>
            The workspace was never created on this hub, or was deleted. Open{" "}
            <code>https://&lt;hub&gt;/w/&lt;workspace-id&gt;</code> in a browser
            to confirm. If it 404s, create a new workspace.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({
  id,
  title,
  symptom,
  children,
}: {
  id: string;
  title: string;
  symptom: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-20">
      <h2 className="text-2xl font-bold tracking-tight">
        <a href={`#${id}`} className="hover:text-accent-cyan">
          {title}
        </a>
      </h2>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-border-subtle bg-background/80 px-4 py-3 font-mono text-body-sm text-muted-foreground">
        {symptom}
      </pre>
      <div className="mt-6 space-y-5 text-body-sm leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-surface-raised/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-foreground [&_p]:text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Cause({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card/50 p-5">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-caption font-bold text-accent-cyan">
          {n}
        </span>
        <h3 className="text-body font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border-subtle bg-background/80 px-3 py-2 font-mono text-caption text-foreground">
      {children}
    </pre>
  );
}

import { statSync } from "node:fs";
import * as pty from "node-pty";

const POSIX_FALLBACK_SHELLS = ["/bin/bash", "/bin/sh", "/usr/bin/sh"];

function isExecutableFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function resolveShell(shell: string): string {
  if (process.platform === "win32") return shell;
  if (shell.includes("/") && isExecutableFile(shell)) return shell;
  if (!shell.includes("/")) return shell; // bare name, let PATH lookup happen
  for (const candidate of POSIX_FALLBACK_SHELLS) {
    if (isExecutableFile(candidate)) return candidate;
  }
  return shell;
}

export function resolveCwd(): string {
  const candidates = [process.env.HOME, process.env.USERPROFILE, process.cwd(), "/"];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch {
      // try next
    }
  }
  return process.cwd();
}

export class TerminalProcess {
  private readonly id: string;
  private readonly ptyProcess: pty.IPty;
  private disposed = false;

  private dataCallback?: (data: string) => void;
  private exitCallback?: (exitCode: number) => void;

  constructor(
    id: string,
    cols: number,
    rows: number,
    shell: string,
    shellArgs: string[],
  ) {
    this.id = id;

    const env = { ...process.env } as Record<string, string>;

    // Set TERM for Unix systems so terminal apps work correctly
    if (process.platform !== "win32") {
      env.TERM = "xterm-256color";
    }

    const resolvedShell = resolveShell(shell);
    const cwd = resolveCwd();

    try {
      this.ptyProcess = pty.spawn(resolvedShell, shellArgs, {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to spawn shell "${resolvedShell}" in cwd "${cwd}": ${reason}`,
      );
    }

    this.ptyProcess.onData((data: string) => {
      if (!this.disposed) {
        this.dataCallback?.(data);
      }
    });

    this.ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      if (!this.disposed) {
        this.exitCallback?.(exitCode);
      }
    });
  }

  get terminalId(): string {
    return this.id;
  }

  onData(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  onExit(callback: (exitCode: number) => void): void {
    this.exitCallback = callback;
  }

  write(data: string): void {
    if (this.disposed) return;
    this.ptyProcess.write(data);
  }

  resize(cols: number, rows: number): void {
    if (this.disposed) return;
    try {
      this.ptyProcess.resize(cols, rows);
    } catch {
      // Ignore resize errors on already-exited processes
    }
  }

  kill(): void {
    if (this.disposed) return;
    try {
      this.ptyProcess.kill();
    } catch {
      // Process may have already exited
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.kill();
  }
}

export interface ShellProbeResult {
  shell: string;
  cwd: string;
}

/**
 * Spawns a throwaway pty against the resolved shell to verify node-pty can
 * actually launch processes in this environment. Throws with a diagnostic
 * message if the spawn fails (bad $SHELL, missing HOME, native binding
 * mismatch, sandbox/TCC restriction, etc.) so the agent can fail fast at
 * startup instead of failing every CreateTerminal silently.
 */
export function probeShell(shell: string, shellArgs: string[]): ShellProbeResult {
  const resolvedShell = resolveShell(shell);
  const cwd = resolveCwd();

  const env = { ...process.env } as Record<string, string>;
  if (process.platform !== "win32") env.TERM = "xterm-256color";

  let probe: pty.IPty;
  try {
    probe = pty.spawn(resolvedShell, shellArgs, {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Shell self-test failed: cannot spawn "${resolvedShell}" in cwd "${cwd}": ${reason}`,
    );
  }

  try {
    probe.kill();
  } catch {
    // Probe may have already exited; nothing to clean up.
  }

  return { shell: resolvedShell, cwd };
}

import * as pty from "node-pty";

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

    this.ptyProcess = pty.spawn(shell, shellArgs, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
      env,
    });

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

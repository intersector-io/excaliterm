import { TerminalProcess } from "./process.js";

export class TerminalManager {
  private readonly terminals = new Map<string, TerminalProcess>();
  private readonly shell: string;

  onCreated?: (id: string) => void;
  onOutput?: (id: string, data: string) => void;
  onExited?: (id: string, exitCode: number) => void;
  onError?: (id: string, error: string) => void;

  constructor(shell: string) {
    this.shell = shell;
  }

  createTerminal(id: string, cols: number, rows: number): TerminalProcess {
    // Destroy existing terminal with same ID if present
    if (this.terminals.has(id)) {
      console.warn(`[TerminalManager] Terminal ${id} already exists, destroying first`);
      this.destroyTerminal(id);
    }

    console.log(`[TerminalManager] Creating terminal ${id} (${cols}x${rows})`);

    try {
      const terminal = new TerminalProcess(id, cols, rows, this.shell);

      terminal.onData((data: string) => {
        this.onOutput?.(id, data);
      });

      terminal.onExit((exitCode: number) => {
        console.log(`[TerminalManager] Terminal ${id} exited with code ${exitCode}`);
        this.terminals.delete(id);
        this.onExited?.(id, exitCode);
      });

      this.terminals.set(id, terminal);
      console.log(`[TerminalManager] Terminal ${id} created successfully`);

      this.onCreated?.(id);
      return terminal;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[TerminalManager] Failed to create terminal ${id}: ${message}`);
      this.onError?.(id, message);
      throw err;
    }
  }

  getTerminal(id: string): TerminalProcess | undefined {
    return this.terminals.get(id);
  }

  writeToTerminal(id: string, data: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      console.warn(`[TerminalManager] writeToTerminal: terminal ${id} not found`);
      return;
    }
    terminal.write(data);
  }

  resizeTerminal(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      console.warn(`[TerminalManager] resizeTerminal: terminal ${id} not found`);
      return;
    }
    terminal.resize(cols, rows);
  }

  destroyTerminal(id: string): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      console.log(`[TerminalManager] Destroying terminal ${id}`);
      this.terminals.delete(id);
      terminal.dispose();
    } else {
      console.warn(`[TerminalManager] destroyTerminal: terminal ${id} not found`);
    }
  }

  destroyAll(): void {
    console.log(
      `[TerminalManager] Destroying all terminals (${this.terminals.size} active)`
    );
    for (const [id, terminal] of this.terminals) {
      try {
        terminal.dispose();
      } catch (err) {
        console.error(`[TerminalManager] Error disposing terminal ${id}:`, err);
      }
    }
    this.terminals.clear();
  }

  get activeCount(): number {
    return this.terminals.size;
  }
}

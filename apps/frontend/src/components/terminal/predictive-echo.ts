import type { Terminal } from "@xterm/xterm";

const MAX_QUEUE = 256;
const STALE_MS = 800;

function isPrintableAscii(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x20 && code <= 0x7e;
}

function skipEscape(data: string, i: number): number {
  if (data[i] !== "\x1b" || i + 1 >= data.length) return i + 1;
  const next = data[i + 1];
  if (next === "[") {
    let j = i + 2;
    while (j < data.length) {
      const cc = data.charCodeAt(j);
      if (cc >= 0x40 && cc <= 0x7e) return j + 1;
      j++;
    }
    return j;
  }
  if (next === "]") {
    let j = i + 2;
    while (j < data.length) {
      if (data[j] === "\x07") return j + 1;
      if (data[j] === "\x1b" && data[j + 1] === "\\") return j + 2;
      j++;
    }
    return j;
  }
  return i + 2;
}

export class PredictiveEcho {
  private queue: string[] = [];
  private lastActivityAt = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly terminal: Terminal) {}

  private isAltScreen(): boolean {
    return this.terminal.buffer.active.type === "alternate";
  }

  tryPredict(data: string): void {
    if (this.isAltScreen()) return;
    if (this.queue.length + data.length > MAX_QUEUE) return;
    for (const ch of data) {
      if (!isPrintableAscii(ch)) return;
    }
    this.terminal.write(data);
    this.lastActivityAt = performance.now();
    for (const ch of data) this.queue.push(ch);
    this.ensureWatchdog();
  }

  filterOutput(data: string): string {
    if (this.queue.length === 0) return data;
    let result = "";
    let matching = true;
    let i = 0;
    while (i < data.length) {
      if (data[i] === "\x1b") {
        const end = skipEscape(data, i);
        result += data.slice(i, end);
        i = end;
        continue;
      }
      if (matching && this.queue.length > 0 && data[i] === this.queue[0]) {
        this.queue.shift();
        this.lastActivityAt = performance.now();
        i++;
        continue;
      }
      matching = false;
      result += data[i];
      i++;
    }
    if (this.queue.length === 0) this.clearTimers();
    return result;
  }

  reset(): void {
    this.queue = [];
    this.clearTimers();
  }

  dispose(): void {
    this.reset();
  }

  private ensureWatchdog(): void {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => this.checkStuck(), 200);
  }

  private clearTimers(): void {
    if (this.watchdog) {
      clearInterval(this.watchdog);
      this.watchdog = null;
    }
    this.lastActivityAt = 0;
  }

  private checkStuck(): void {
    if (this.queue.length === 0) {
      this.clearTimers();
      return;
    }
    const now = performance.now();
    const stuck = now - this.lastActivityAt > STALE_MS;
    if (!stuck) return;
    // Server isn't echoing (e.g. password prompt). Erase locally written
    // predictions so secrets don't linger on screen.
    const eraseCount = this.queue.length;
    let erase = "";
    for (let i = 0; i < eraseCount; i++) erase += "\b \b";
    this.terminal.write(erase);
    this.queue = [];
    this.clearTimers();
  }
}

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { HubConnectionState } from "@microsoft/signalr";
import "@xterm/xterm/css/xterm.css";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { getTerminalHub } from "@/lib/signalr-client";
import { useTerminalStore } from "@/stores/terminal-store";
import type { TerminalStatus } from "@excaliterm/shared-types";

interface TerminalViewProps {
  terminalId: string;
  status: TerminalStatus;
}

export function TerminalView({ terminalId, status }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);
  const previousLockOwnerRef = useRef<string | null>(null);
  const { lockInfo, lockedByOther } = useTerminalCollaboration(terminalId);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const terminalHub = getTerminalHub();

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
      fontWeight: 500,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      lineHeight: 1.28,
      theme: {
        background: "#0c1020",
        foreground: "#e8ebf2",
        cursor: "#f8fafc",
        selectionBackground: "#39405a",
        selectionForeground: "#f8fafc",
        black: "#15192b",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#f9a8d4",
        cyan: "#67e8f9",
        white: "#e8ebf2",
        brightBlack: "#646b83",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde047",
        brightBlue: "#93c5fd",
        brightMagenta: "#fbcfe8",
        brightCyan: "#a5f3fc",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);

    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // Container might not be visible yet
      }
    });

    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
            terminal.refresh(0, terminal.rows - 1);
          } catch {
            // Ignore font-load fit errors
          }
        });
      });
    }

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Replay buffered output
    const buffered = useTerminalStore.getState().getOutput(terminalId);
    for (const chunk of buffered) {
      terminal.write(chunk);
    }

    // Handle user input -> send via SignalR (only if active)
    const inputDisposable = terminal.onData((data) => {
      if (status !== "active") return;
      terminalHub.invoke("TerminalInput", terminalId, data).catch(() => {});
    });

    // Handle terminal resize -> send via SignalR
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      terminalHub.invoke("TerminalResize", terminalId, cols, rows).catch(() => {});
    });

    // Listen for output from SignalR
    function handleOutput(msg: { terminalId: string; data: string }) {
      if (msg.terminalId === terminalId) {
        terminal.write(msg.data);
      }
    }

    function handleExited(msg: { terminalId: string; exitCode: number }) {
      if (msg.terminalId === terminalId) {
        terminal.write(`\r\n\x1b[90m[Process exited with code ${msg.exitCode}]\x1b[0m\r\n`);
      }
    }

    function handleDisconnected(msg: { terminalId: string }) {
      if (msg.terminalId === terminalId) {
        terminal.write("\r\n\x1b[33m[Host offline. Terminal unavailable.]\x1b[0m\r\n");
      }
    }

    function handleError(msg: { terminalId: string; error: string }) {
      if (msg.terminalId === terminalId) {
        terminal.write(`\r\n\x1b[31m[Error: ${msg.error}]\x1b[0m\r\n`);
      }
    }

    terminalHub.on("TerminalOutput", handleOutput);
    terminalHub.on("TerminalExited", handleExited);
    terminalHub.on("TerminalDisconnected", handleDisconnected);
    terminalHub.on("TerminalError", handleError);

    // ResizeObserver for container resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch {
          // Ignore fit errors during transitions
        }
      });
    });
    resizeObserver.observe(containerRef.current);

    // Send initial size to backend
    terminalHub.invoke("TerminalResize", terminalId, terminal.cols, terminal.rows).catch(() => {});

    // Request buffered output from Redis for persistence across reloads
    const requestBuffer = () => {
      terminalHub.invoke("RequestTerminalBuffer", terminalId).catch(() => {});
    };

    if (terminalHub.state === HubConnectionState.Connected) {
      requestBuffer();
    } else {
      const interval = setInterval(() => {
        if (terminalHub.state === HubConnectionState.Connected) {
          clearInterval(interval);
          requestBuffer();
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 10_000);
    }

    return () => {
      inputDisposable.dispose();
      resizeDisposable.dispose();
      terminalHub.off("TerminalOutput", handleOutput);
      terminalHub.off("TerminalExited", handleExited);
      terminalHub.off("TerminalDisconnected", handleDisconnected);
      terminalHub.off("TerminalError", handleError);
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, [terminalId]);

  // Disable cursor and input when terminal becomes inactive
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const interactive = status === "active" && !lockedByOther;

    if (!interactive) {
      terminal.options.cursorBlink = false;
      terminal.options.disableStdin = true;
    } else {
      terminal.options.cursorBlink = true;
      terminal.options.disableStdin = false;
    }

    if (lockedByOther && previousLockOwnerRef.current !== lockInfo?.clientId) {
      terminal.write(`\r\n\x1b[33m[Locked by ${lockInfo?.displayName ?? "another collaborator"}]\x1b[0m\r\n`);
    }

    if (!lockedByOther && previousLockOwnerRef.current && previousLockOwnerRef.current !== lockInfo?.clientId) {
      terminal.write("\r\n\x1b[90m[Terminal lock released]\x1b[0m\r\n");
    }

    previousLockOwnerRef.current = lockInfo?.clientId ?? null;
  }, [status, lockedByOther, lockInfo?.clientId, lockInfo?.displayName]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-lg border border-border-subtle bg-surface-sunken shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      style={{ padding: "14px 14px 12px" }}
    />
  );
}

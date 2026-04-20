import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { HubConnectionState } from "@microsoft/signalr";
import "@xterm/xterm/css/xterm.css";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { getTerminalHub } from "@/lib/signalr-client";
import { useTerminalStore } from "@/stores/terminal-store";
import type { TerminalStatus } from "@terminal-proxy/shared-types";

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
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      lineHeight: 1.2,
      theme: {
        background: "#12122a",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        selectionBackground: "#3f3f46",
        selectionForeground: "#e4e4e7",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
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
      className="h-full w-full"
      style={{ padding: "4px" }}
    />
  );
}

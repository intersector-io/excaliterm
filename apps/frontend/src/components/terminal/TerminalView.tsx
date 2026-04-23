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
  compact?: boolean;
  inputRef?: React.MutableRefObject<((data: string) => void) | null>;
  scrollRef?: React.MutableRefObject<{
    scrollUp: () => void;
    scrollDown: () => void;
    scrollToTop: () => void;
    scrollToBottom: () => void;
  } | null>;
  onCommandDetected?: (terminalId: string, command: string) => void;
}

export function TerminalView({ terminalId, status, compact, inputRef, scrollRef, onCommandDetected }: Readonly<TerminalViewProps>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);
  const previousLockOwnerRef = useRef<string | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const commandBufferRef = useRef("");
  const bufferCorruptedRef = useRef(false);
  const onCommandDetectedRef = useRef(onCommandDetected);
  onCommandDetectedRef.current = onCommandDetected;
  const { lockInfo, lockedByOther } = useTerminalCollaboration(terminalId);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const terminalHub = getTerminalHub();

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: compact ? 12 : 14,
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

    if (document.fonts) {
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

    // Expose input injection for virtual keyboard bar
    if (inputRef) {
      inputRef.current = (data: string) => {
        if (statusRef.current !== "active") return;
        terminalHub.invoke("TerminalInput", terminalId, data).catch(() => {});
      };
    }

    // Expose scroll methods for scroll buttons
    if (scrollRef) {
      scrollRef.current = {
        scrollUp: () => terminal.scrollLines(-10),
        scrollDown: () => terminal.scrollLines(10),
        scrollToTop: () => terminal.scrollToTop(),
        scrollToBottom: () => terminal.scrollToBottom(),
      };
    }

    const buffered = useTerminalStore.getState().getOutput(terminalId);
    for (const chunk of buffered) {
      terminal.write(chunk);
    }

    const inputDisposable = terminal.onData((data) => {
      if (statusRef.current !== "active") return;
      terminalHub.invoke("TerminalInput", terminalId, data).catch(() => {});

      for (let i = 0; i < data.length; i++) {
        const char = data[i]!;
        const code = char.charCodeAt(0);

        if (char === "\r") {
          if (!bufferCorruptedRef.current) {
            const cmd = commandBufferRef.current.trim();
            if (cmd.length > 0 && cmd.length <= 1000) {
              onCommandDetectedRef.current?.(terminalId, cmd);
            }
          }
          commandBufferRef.current = "";
          bufferCorruptedRef.current = false;
        } else if (char === "\x7f" || char === "\b") {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
        } else if (char === "\x1b") {
          // Escape sequences can carry shell history text we never saw, making the buffer unreliable
          bufferCorruptedRef.current = true;
        } else if (code === 3 || code === 4) {
          commandBufferRef.current = "";
          bufferCorruptedRef.current = false;
        } else if (code >= 32) {
          if (!bufferCorruptedRef.current && commandBufferRef.current.length < 1000) {
            commandBufferRef.current += char;
          }
        }
      }
    });

    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      terminalHub.invoke("TerminalResize", terminalId, cols, rows).catch(() => {});
    });

    // Fix cursor positioning after exiting alternate screen buffer apps (vim, claude, htop)
    // ConPTY on Windows can leave the cursor displaced when switching back to the normal buffer
    const bufferChangeDisposable = terminal.buffer.onBufferChange((buffer) => {
      if (buffer === terminal.buffer.normal) {
        requestAnimationFrame(() => {
          terminal.scrollToBottom();
          terminal.refresh(0, terminal.rows - 1);
        });
      }
    });

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

    terminalHub.invoke("TerminalResize", terminalId, terminal.cols, terminal.rows).catch(() => {});

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
      bufferChangeDisposable.dispose();
      terminalHub.off("TerminalOutput", handleOutput);
      terminalHub.off("TerminalExited", handleExited);
      terminalHub.off("TerminalDisconnected", handleDisconnected);
      terminalHub.off("TerminalError", handleError);
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
      if (inputRef) inputRef.current = null;
      if (scrollRef) scrollRef.current = null;
    };
  }, [terminalId]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const interactive = status === "active" && !lockedByOther;

    if (interactive) {
      terminal.options.cursorBlink = true;
      terminal.options.disableStdin = false;
    } else {
      terminal.options.cursorBlink = false;
      terminal.options.disableStdin = true;
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
      style={{ padding: compact ? "4px 6px" : "14px 14px 12px" }}
    />
  );
}

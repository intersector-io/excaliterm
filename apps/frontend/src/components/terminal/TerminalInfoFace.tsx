import { useCallback, useState } from "react";
import {
  RotateCw,
  Copy,
  Lock,
  LockOpen,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  ChevronsDown,
  ArrowUpToLine,
  ArrowDownToLine,
  CornerDownLeft,
  Mic,
  MicOff,
  KeyboardOff,
  Delete,
} from "lucide-react";
import { toast } from "sonner";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { useCommandHistoryQueries } from "@/hooks/use-command-history";
import { useTerminals } from "@/hooks/use-terminal";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { copyToClipboard } from "@/lib/clipboard";
import { TagEditor } from "@/components/canvas/TagEditor";
import type { TerminalStatus } from "@excaliterm/shared-types";
import { HoldButton } from "./HoldButton";

interface TerminalInfoFaceProps {
  terminalId: string;
  status: TerminalStatus;
  tags?: string[];
  onFlipBack: () => void;
  onInput?: (data: string) => void;
  onRunCommand?: (command: string) => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  onScrollTop?: () => void;
  onScrollBottom?: () => void;
  onClose?: () => void;
}

const KEY_ESC = "\x1b";
const KEY_TAB = "\t";
const KEY_SHIFT_TAB = "\x1b[Z";
const KEY_UP = "\x1b[A";
const KEY_DOWN = "\x1b[B";
const KEY_RIGHT = "\x1b[C";
const KEY_LEFT = "\x1b[D";
const KEY_BACKSPACE = "\x7f";

const DECK_MODE_KEY = "excaliterm.deckMode";
type DeckMode = "agent" | "shell";
function readDeckMode(): DeckMode {
  try {
    const v = localStorage.getItem(DECK_MODE_KEY);
    return v === "shell" ? "shell" : "agent";
  } catch {
    return "agent";
  }
}
function writeDeckMode(mode: DeckMode) {
  try {
    localStorage.setItem(DECK_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function hideSoftKeyboard() {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

const CAP =
  "relative flex select-none items-center justify-center rounded-xl " +
  "bg-surface-raised font-mono font-medium text-foreground/90 " +
  "shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)] " +
  "transition-[transform,box-shadow,background-color] duration-75 " +
  "active:translate-y-[1px] active:bg-surface-raised/80 " +
  "active:shadow-[inset_0_2px_0_0_rgba(0,0,0,0.3),inset_0_-1px_0_0_rgba(255,255,255,0.02)] " +
  "touch-none";

const CAP_MUTED = CAP + " text-muted-foreground";

const CAP_LATCHED =
  "relative flex select-none items-center justify-center rounded-xl " +
  "bg-accent-cyan/12 font-mono font-semibold text-accent-cyan " +
  "ring-1 ring-inset ring-accent-cyan/45 " +
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_0_rgba(0,0,0,0.2)] " +
  "transition-[transform,box-shadow] duration-75 active:translate-y-[1px] " +
  "keycap-breathe touch-none";

const CAP_DANGER =
  "relative flex select-none items-center justify-center rounded-xl " +
  "bg-accent-red/6 font-mono font-medium text-accent-red/90 " +
  "shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.03)] " +
  "transition-[transform,box-shadow] duration-75 active:translate-y-[1px] active:bg-accent-red/10 " +
  "touch-none";

// Liquid-glass primary: inner refraction border + tinted matte shadow. No neon.
const CAP_PRIMARY =
  "relative flex select-none items-center justify-center rounded-xl " +
  "bg-accent-cyan/95 text-background font-mono font-semibold " +
  "border border-accent-cyan/70 " +
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28),inset_0_-1px_0_0_rgba(0,0,0,0.18),0_1px_0_0_rgba(34,211,238,0.18)] " +
  "transition-[transform,box-shadow] duration-75 active:translate-y-[1px] active:bg-accent-cyan " +
  "touch-none";

const CAP_CHORD =
  "relative flex select-none items-center justify-center rounded-xl " +
  "bg-surface-sunken/80 font-mono font-semibold text-accent-amber/80 " +
  "ring-1 ring-inset ring-accent-amber/15 " +
  "shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.03)] " +
  "transition-[transform,box-shadow,background-color] duration-75 " +
  "active:translate-y-[1px] active:bg-surface-sunken " +
  "touch-none";

export function TerminalInfoFace({
  terminalId,
  status,
  tags,
  onFlipBack,
  onInput,
  onRunCommand,
  onScrollUp,
  onScrollDown,
  onScrollTop,
  onScrollBottom,
  onClose,
}: Readonly<TerminalInfoFaceProps>) {
  const { commands } = useCommandHistoryQueries(terminalId);
  const { updateTerminal, deleteTerminal } = useTerminals();
  const {
    lockInfo,
    lockedByCurrentCollaborator,
    lockedByOther,
    lockTerminal,
    unlockTerminal,
  } = useTerminalCollaboration(terminalId);

  const [ctrlActive, setCtrlActive] = useState(false);
  const [deckMode, setDeckMode] = useState<DeckMode>(() => readDeckMode());
  const switchMode = useCallback((mode: DeckMode) => {
    setDeckMode(mode);
    writeDeckMode(mode);
  }, []);
  const { isListening, isSupported: speechSupported, start: startSpeech, stop: stopSpeech } =
    useSpeechRecognition((text) => onInput?.(text));

  const recentCommands = commands.slice(0, 8);
  const isActive = status === "active";

  const send = useCallback(
    (data: string, label?: string) => {
      if (!onInput) return;
      if (ctrlActive && label && label.length === 1) {
        const code = label.toUpperCase().charCodeAt(0) - 64;
        if (code >= 1 && code <= 26) {
          onInput(String.fromCharCode(code));
        }
      } else {
        onInput(data);
      }
      if (ctrlActive) setCtrlActive(false);
    },
    [ctrlActive, onInput],
  );

  const sendCtrl = useCallback(
    (letter: string) => {
      if (!onInput) return;
      const code = letter.toUpperCase().charCodeAt(0) - 64;
      if (code >= 1 && code <= 26) onInput(String.fromCharCode(code));
    },
    [onInput],
  );

  const handleCopyId = useCallback(() => {
    copyToClipboard(terminalId).then(() => toast.success("Copied")).catch(() => {});
  }, [terminalId]);

  const handleToggleLock = useCallback(async () => {
    try {
      if (lockedByCurrentCollaborator) {
        await unlockTerminal(terminalId);
      } else if (!lockInfo) {
        await lockTerminal(terminalId);
      }
    } catch {
      toast.error("Failed to change lock");
    }
  }, [terminalId, lockInfo, lockedByCurrentCollaborator, lockTerminal, unlockTerminal]);

  const handleClose = useCallback(async () => {
    try {
      if (isActive) await deleteTerminal(terminalId);
      onClose?.();
    } catch {
      toast.error("Failed to close terminal");
    }
  }, [terminalId, isActive, deleteTerminal, onClose]);

  const handleTagsChange = useCallback(
    (newTags: string[]) => {
      updateTerminal({ id: terminalId, data: { tags: newTags } }).catch(() => {});
    },
    [terminalId, updateTerminal],
  );

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-card via-card to-surface-sunken">
      {/* Header strip */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          onClick={onFlipBack}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-accent-cyan transition-colors active:bg-surface-raised"
          aria-label="Back to terminal"
        >
          <RotateCw className="h-5 w-5" />
        </button>
        <span className="text-caption font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
          Command Deck
        </span>
        <div className="ml-auto flex items-center gap-0.5 rounded-full bg-surface-sunken/70 p-0.5 text-[0.68rem] font-mono font-semibold uppercase tracking-[0.12em]">
          <button
            onClick={() => switchMode("agent")}
            className={
              "px-2.5 py-1 rounded-full transition-colors " +
              (deckMode === "agent"
                ? "bg-accent-cyan/15 text-accent-cyan"
                : "text-muted-foreground/60 active:text-foreground")
            }
          >
            agent
          </button>
          <button
            onClick={() => switchMode("shell")}
            className={
              "px-2.5 py-1 rounded-full transition-colors " +
              (deckMode === "shell"
                ? "bg-accent-cyan/15 text-accent-cyan"
                : "text-muted-foreground/60 active:text-foreground")
            }
          >
            shell
          </button>
        </div>
        <button
          onClick={handleCopyId}
          className="flex items-center gap-1.5 font-mono text-caption text-muted-foreground/50 active:text-foreground"
          title="Copy terminal ID"
        >
          <Copy className="h-3 w-3" />
        </button>
      </div>

      {/* Locked control surface — fits the viewport, no scroll */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-3 py-2">
        {/* Tags (compact inline) */}
        <div className="shrink-0 rounded-xl border border-border-subtle/50 bg-surface-sunken/40 px-3 py-1.5">
          <TagEditor tags={tags ?? []} onTagsChange={handleTagsChange} />
        </div>

        {/* Primary control panel: scroll | d-pad | action stack */}
        <div className="grid shrink-0 grid-cols-3 gap-2">
          {/* Scroll column */}
          <div className="flex flex-col gap-2">
            <HoldButton
              className={CAP_MUTED + " h-12"}
              onFire={() => onScrollTop?.()}
              aria-label="Scroll to top"
            >
              <ArrowUpToLine className="h-5 w-5" />
            </HoldButton>
            <HoldButton
              className={CAP + " h-12"}
              onFire={() => onScrollUp?.()}
              repeatable
              aria-label="Page up"
            >
              <ChevronsUp className="h-6 w-6" />
            </HoldButton>
            <HoldButton
              className={CAP + " h-12"}
              onFire={() => onScrollDown?.()}
              repeatable
              aria-label="Page down"
            >
              <ChevronsDown className="h-6 w-6" />
            </HoldButton>
            <HoldButton
              className={CAP_MUTED + " h-12"}
              onFire={() => onScrollBottom?.()}
              aria-label="Scroll to bottom"
            >
              <ArrowDownToLine className="h-5 w-5" />
            </HoldButton>
          </div>

          {/* D-pad */}
          <div className="grid grid-cols-3 grid-rows-4 gap-1">
            <div />
            <HoldButton className={CAP + " h-12"} onFire={() => send(KEY_UP)} repeatable aria-label="Up">
              <ChevronUp className="h-6 w-6" />
            </HoldButton>
            <div />
            <HoldButton className={CAP + " h-12"} onFire={() => send(KEY_LEFT)} repeatable aria-label="Left">
              <ChevronLeft className="h-6 w-6" />
            </HoldButton>
            <div
              className="flex h-12 items-center justify-center rounded-full bg-surface-sunken/60 text-[0.6rem] font-mono uppercase tracking-[0.16em] text-muted-foreground/40"
              aria-hidden
            >
              nav
            </div>
            <HoldButton className={CAP + " h-12"} onFire={() => send(KEY_RIGHT)} repeatable aria-label="Right">
              <ChevronRight className="h-6 w-6" />
            </HoldButton>
            <div />
            <HoldButton className={CAP + " h-12"} onFire={() => send(KEY_DOWN)} repeatable aria-label="Down">
              <ChevronDown className="h-6 w-6" />
            </HoldButton>
            <div />
            <HoldButton
              className={CAP_MUTED + " h-10 col-span-3 text-body-sm"}
              onFire={() => send(" ", " ")}
            >
              space
            </HoldButton>
          </div>

          {/* Action stack */}
          <div className="flex flex-col gap-2">
            <HoldButton
              className={CAP_MUTED + " h-11 text-body-sm"}
              onFire={() => send(KEY_ESC)}
            >
              esc
            </HoldButton>
            <HoldButton
              className={CAP + " h-11 text-body-sm"}
              onFire={() => send(KEY_BACKSPACE)}
              repeatable
              aria-label="Backspace"
            >
              <Delete className="h-5 w-5" />
            </HoldButton>
            <HoldButton
              className={CAP_MUTED + " h-11 text-body-sm"}
              onFire={() => send(KEY_TAB)}
            >
              tab
            </HoldButton>
            <HoldButton
              className={CAP_PRIMARY + " h-[4.25rem] flex-1 text-body"}
              onFire={() => send("\r")}
              haptic={10}
              aria-label="Enter"
            >
              <CornerDownLeft className="h-5 w-5 mr-1.5" />
              enter
            </HoldButton>
          </div>
        </div>

        {/* Context-specific row: Agent actions or Shell chords */}
        {deckMode === "agent" ? (
          <div className="shrink-0 rounded-xl border border-border-subtle/40 bg-surface-sunken/40 px-2.5 py-1.5">
            <span className="mb-1.5 block text-caption uppercase tracking-[0.16em] text-muted-foreground/45">
              Agent
            </span>
            <div className="grid grid-cols-6 gap-1.5">
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => send("/", "/")}
                title="Slash command prefix"
              >
                /
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => send("@", "@")}
                title="File / context reference"
              >
                @
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => send("#", "#")}
                title="Memory / tag"
              >
                #
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => send(KEY_SHIFT_TAB)}
                title="Shift+Tab · cycle mode"
              >
                ⇧⇥
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => send("y", "y")}
                title="Approve"
              >
                y
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => send("n", "n")}
                title="Reject"
              >
                n
              </HoldButton>
            </div>
          </div>
        ) : (
          <div className="shrink-0 rounded-xl border border-border-subtle/40 bg-surface-sunken/40 px-2.5 py-1.5">
            <span className="mb-1.5 block text-caption uppercase tracking-[0.16em] text-muted-foreground/45">
              Chords
            </span>
            <div className="grid grid-cols-6 gap-1.5">
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => sendCtrl("C")}
                title="Ctrl+C · cancel"
              >
                ^C
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => sendCtrl("D")}
                title="Ctrl+D · EOF / logout"
              >
                ^D
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => sendCtrl("L")}
                title="Ctrl+L · clear screen"
              >
                ^L
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => sendCtrl("R")}
                title="Ctrl+R · reverse search"
              >
                ^R
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => sendCtrl("Z")}
                title="Ctrl+Z · suspend"
              >
                ^Z
              </HoldButton>
              <HoldButton
                className={CAP_CHORD + " h-11 text-body-sm"}
                onFire={() => sendCtrl("W")}
                repeatable
                title="Ctrl+W · delete word"
              >
                ^W
              </HoldButton>
            </div>
          </div>
        )}

        {/* Modifier row */}
        <div className="grid shrink-0 grid-cols-5 gap-2">
          <HoldButton
            className={(ctrlActive ? CAP_LATCHED : CAP_MUTED) + " h-11 text-body-sm"}
            onFire={() => setCtrlActive((p) => !p)}
            haptic={15}
            aria-pressed={ctrlActive}
          >
            ctrl
          </HoldButton>
          <HoldButton className={CAP + " h-11 text-body-sm"} onFire={() => send("~", "~")}>
            ~
          </HoldButton>
          <HoldButton className={CAP + " h-11 text-body-sm"} onFire={() => send("|", "|")}>
            |
          </HoldButton>
          <HoldButton className={CAP + " h-11 text-body-sm"} onFire={() => send("-", "-")}>
            -
          </HoldButton>
          <HoldButton className={CAP + " h-11 text-body-sm"} onFire={() => send("_", "_")}>
            _
          </HoldButton>
        </div>

        {/* Agent-mode: quick numerics for option picks · Shell-mode: punctuation */}
        {deckMode === "agent" ? (
          <div className="grid shrink-0 grid-cols-10 gap-1">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((ch) => (
              <HoldButton
                key={ch}
                className={CAP + " h-10 text-body-sm"}
                onFire={() => send(ch, ch)}
              >
                {ch}
              </HoldButton>
            ))}
          </div>
        ) : (
          <div className="grid shrink-0 grid-cols-8 gap-1.5">
            {["/", "\\", ":", ";", ".", ",", ">", "<"].map((ch) => (
              <HoldButton
                key={ch}
                className={CAP + " h-10 text-body-sm"}
                onFire={() => send(ch, ch)}
              >
                {ch}
              </HoldButton>
            ))}
          </div>
        )}

        {/* Recent commands — flex absorber, clips to remaining viewport */}
        {recentCommands.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border-subtle/50 bg-surface-sunken/40 px-3 py-2">
            <span className="mb-1.5 block shrink-0 text-caption uppercase tracking-[0.16em] text-muted-foreground/45">
              Recent
            </span>
            <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
              {recentCommands.map((cmd, i) => (
                <button
                  key={`${cmd.command}-${i}`}
                  onClick={() => {
                    onRunCommand?.(cmd.command);
                    onFlipBack();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg bg-card/60 px-3 py-1.5 text-left font-mono text-caption text-foreground/80 transition-colors active:bg-card active:text-foreground"
                >
                  <span className="text-accent-cyan/40">$</span>
                  <span className="truncate">{cmd.command}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="grid shrink-0 grid-cols-2 gap-2">
          {isActive && (
            <button
              onClick={handleToggleLock}
              disabled={lockedByOther}
              className={CAP + " h-10 gap-2 text-body-sm disabled:opacity-30"}
            >
              {lockedByCurrentCollaborator ? (
                <LockOpen className="h-4 w-4 text-accent-cyan" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {lockedByCurrentCollaborator ? "Unlock" : "Lock"}
            </button>
          )}
          {speechSupported && (
            <button
              onClick={() => (isListening ? stopSpeech() : startSpeech())}
              className={(isListening ? CAP_LATCHED : CAP) + " h-10 gap-2 text-body-sm"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isListening ? "Listening" : "Dictate"}
            </button>
          )}
          <button
            onClick={() => {
              hideSoftKeyboard();
              onFlipBack();
            }}
            className={CAP_MUTED + " h-10 gap-2 text-body-sm"}
          >
            <KeyboardOff className="h-4 w-4" />
            Hide keyboard
          </button>
          <button onClick={handleClose} className={CAP_DANGER + " h-10 gap-2 text-body-sm"}>
            <Trash2 className="h-4 w-4" />
            {isActive ? "Close" : "Dismiss"}
          </button>
        </div>
      </div>

    </div>
  );
}

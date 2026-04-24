import { useState, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  ChevronsDown,
  KeyboardOff,
  CornerDownLeft,
  Delete,
} from "lucide-react";
import { HoldButton } from "./HoldButton";

interface VirtualKeyboardBarProps {
  onInput: (data: string) => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
}

// Escape sequences
const KEY_ESC = "\x1b";
const KEY_TAB = "\t";
const KEY_UP = "\x1b[A";
const KEY_DOWN = "\x1b[B";
const KEY_RIGHT = "\x1b[C";
const KEY_LEFT = "\x1b[D";
const KEY_BACKSPACE = "\x7f";

function hideSoftKeyboard() {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

const CAP_BASE =
  "relative flex flex-1 min-h-[48px] select-none items-center justify-center rounded-lg " +
  "bg-surface-raised text-body-sm font-mono font-medium tracking-tight text-foreground/85 " +
  "shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.04)] " +
  "transition-[transform,box-shadow,background-color] duration-75 " +
  "active:translate-y-[1px] active:bg-surface-raised/80 " +
  "active:shadow-[inset_0_2px_0_0_rgba(0,0,0,0.25),inset_0_-1px_0_0_rgba(255,255,255,0.02)] " +
  "touch-none";

const CAP_MUTED = CAP_BASE + " text-muted-foreground";

const CAP_LATCHED =
  "relative flex flex-1 min-h-[48px] select-none items-center justify-center rounded-lg " +
  "bg-accent-cyan/12 text-body-sm font-mono font-semibold tracking-tight text-accent-cyan " +
  "ring-1 ring-inset ring-accent-cyan/45 " +
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),inset_0_-1px_0_0_rgba(0,0,0,0.2)] " +
  "transition-[transform,box-shadow] duration-75 active:translate-y-[1px] " +
  "keycap-breathe touch-none";

export function VirtualKeyboardBar({
  onInput,
  onScrollUp,
  onScrollDown,
}: Readonly<VirtualKeyboardBarProps>) {
  const [ctrlActive, setCtrlActive] = useState(false);

  const sendChar = useCallback(
    (data: string, label?: string) => {
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

  return (
    <div className="shrink-0 border-t border-border-default bg-gradient-to-b from-card to-surface-sunken px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),6px)] space-y-1">
      {/* Row 1: modifiers & commit */}
      <div className="flex gap-1">
        <HoldButton className={CAP_MUTED} onFire={() => sendChar(KEY_ESC)}>
          esc
        </HoldButton>
        <HoldButton className={CAP_MUTED} onFire={() => sendChar(KEY_TAB)}>
          tab
        </HoldButton>
        <HoldButton
          className={ctrlActive ? CAP_LATCHED : CAP_MUTED}
          onFire={() => setCtrlActive((p) => !p)}
          haptic={15}
          aria-pressed={ctrlActive}
        >
          ctrl
        </HoldButton>
        <HoldButton
          className={CAP_BASE}
          onFire={() => sendChar(KEY_BACKSPACE)}
          repeatable
          aria-label="Backspace"
        >
          <Delete className="h-4 w-4" />
        </HoldButton>
        <HoldButton className={CAP_BASE} onFire={() => sendChar("\r")} aria-label="Enter">
          <CornerDownLeft className="h-4 w-4" />
        </HoldButton>
        <HoldButton
          className={CAP_MUTED}
          onFire={hideSoftKeyboard}
          aria-label="Hide keyboard"
        >
          <KeyboardOff className="h-4 w-4" />
        </HoldButton>
      </div>
      {/* Row 2: navigation & scroll */}
      <div className="flex gap-1">
        <HoldButton
          className={CAP_BASE}
          onFire={() => sendChar(KEY_UP)}
          repeatable
          aria-label="Up"
        >
          <ChevronUp className="h-4 w-4" />
        </HoldButton>
        <HoldButton
          className={CAP_BASE}
          onFire={() => sendChar(KEY_DOWN)}
          repeatable
          aria-label="Down"
        >
          <ChevronDown className="h-4 w-4" />
        </HoldButton>
        <HoldButton
          className={CAP_BASE}
          onFire={() => sendChar(KEY_LEFT)}
          repeatable
          aria-label="Left"
        >
          <ChevronLeft className="h-4 w-4" />
        </HoldButton>
        <HoldButton
          className={CAP_BASE}
          onFire={() => sendChar(KEY_RIGHT)}
          repeatable
          aria-label="Right"
        >
          <ChevronRight className="h-4 w-4" />
        </HoldButton>
        <HoldButton
          className={CAP_MUTED}
          onFire={() => onScrollUp?.()}
          repeatable
          aria-label="Scroll up"
        >
          <ChevronsUp className="h-4 w-4" />
        </HoldButton>
        <HoldButton
          className={CAP_MUTED}
          onFire={() => onScrollDown?.()}
          repeatable
          aria-label="Scroll down"
        >
          <ChevronsDown className="h-4 w-4" />
        </HoldButton>
      </div>
    </div>
  );
}

import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";

interface VirtualKeyboardBarProps {
  onInput: (data: string) => void;
}

// Escape sequences for special keys
const KEY_ESC = "\x1b";
const KEY_TAB = "\t";
const KEY_UP = "\x1b[A";
const KEY_DOWN = "\x1b[B";
const KEY_RIGHT = "\x1b[C";
const KEY_LEFT = "\x1b[D";

export function VirtualKeyboardBar({ onInput }: Readonly<VirtualKeyboardBarProps>) {
  const [ctrlActive, setCtrlActive] = useState(false);
  const { isListening, isSupported, start, stop } = useSpeechRecognition((text) => {
    onInput(text);
  });

  const handleKey = useCallback(
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

  const toggleCtrl = useCallback(() => {
    setCtrlActive((prev) => !prev);
  }, []);

  const keyClass =
    "flex flex-1 min-h-[40px] items-center justify-center rounded-md bg-surface-raised text-caption font-mono text-muted-foreground transition-colors active:scale-[0.95] active:bg-surface-raised/80 active:text-foreground";

  const ctrlClass = ctrlActive
    ? "flex flex-1 min-h-[40px] items-center justify-center rounded-md bg-accent-cyan/10 text-caption font-mono text-accent-cyan ring-1 ring-accent-cyan/40 transition-colors active:scale-[0.95]"
    : keyClass;

  return (
    <div className="shrink-0 border-t border-border-default bg-card px-2 py-1.5 space-y-1">
      {/* Row 1 */}
      <div className="flex gap-1">
        <button className={keyClass} onClick={() => handleKey(KEY_ESC)}>
          ESC
        </button>
        <button className={keyClass} onClick={() => handleKey(KEY_TAB)}>
          TAB
        </button>
        <button className={ctrlClass} onClick={toggleCtrl}>
          CTRL
        </button>
        <button className={keyClass} onClick={() => handleKey("/", "/")}>
          /
        </button>
        <button className={keyClass} onClick={() => handleKey("\r")}>
          Enter
        </button>
      </div>
      {/* Row 2 */}
      <div className="flex gap-1">
        <button className={keyClass} onClick={() => handleKey(KEY_UP)}>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button className={keyClass} onClick={() => handleKey(KEY_DOWN)}>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button className={keyClass} onClick={() => handleKey(KEY_LEFT)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button className={keyClass} onClick={() => handleKey(KEY_RIGHT)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        {isSupported ? (
          <button
            className={isListening
              ? "flex flex-1 min-h-[40px] items-center justify-center rounded-md bg-accent-red/15 text-accent-red ring-1 ring-accent-red/40 transition-colors active:scale-[0.95]"
              : keyClass
            }
            onClick={() => (isListening ? stop() : start())}
          >
            {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button className={keyClass} onClick={() => handleKey("/", "/")}>
            /
          </button>
        )}
      </div>
    </div>
  );
}

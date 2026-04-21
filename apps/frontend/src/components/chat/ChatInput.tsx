import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (content: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    // Max 6 lines (~24px per line)
    const maxHeight = 24 * 6;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  const isEmpty = value.trim().length === 0;

  return (
    <div className="border-t border-border-default px-3 py-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Markdown supported)"
          rows={1}
          className={cn(
            "flex-1 resize-none bg-surface-sunken text-body-sm text-foreground placeholder:text-muted-foreground/50",
            "rounded-md border border-border-default px-3 py-2",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "scrollbar-thin",
          )}
          style={{ maxHeight: `${24 * 6}px` }}
        />
        <button
          onClick={handleSend}
          disabled={isEmpty}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors",
            isEmpty
              ? "text-muted-foreground"
              : "bg-accent-blue text-white hover:bg-accent-blue/80",
          )}
          title="Send message"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

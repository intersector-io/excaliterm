import { useRef, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessageItem } from "@/stores/chat-store";

interface ChatMessageListProps {
  messages: ChatMessageItem[];
  isLoading: boolean;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function groupByDate(messages: ChatMessageItem[]) {
  const groups: { date: string; label: string; messages: ChatMessageItem[] }[] = [];

  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    const last = groups[groups.length - 1];

    if (last && last.date === dateKey) {
      last.messages.push(msg);
    } else {
      groups.push({
        date: dateKey,
        label: formatDateSeparator(msg.createdAt),
        messages: [msg],
      });
    }
  }

  return groups;
}

export function ChatMessageList({
  messages,
  isLoading,
  hasMore,
  loadingOlder,
  onLoadOlder,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  const groups = useMemo(() => groupByDate(messages), [messages]);

  // Auto-scroll to bottom on new messages (appended at end)
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currentCount = messages.length;
    prevMessageCountRef.current = currentCount;

    // Scroll to bottom on initial load or when new messages arrive at the end
    if (currentCount > prevCount || prevCount === 0) {
      // Only auto-scroll if user is already near the bottom or it's initial load
      const container = containerRef.current;
      if (!container) {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
        return;
      }

      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const isNearBottom = distanceFromBottom < 150 || prevCount === 0;

      if (isNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: prevCount === 0 ? "instant" : "smooth" });
      }
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {/* Load older button */}
      {hasMore && (
        <div className="flex justify-center py-3">
          <button
            onClick={onLoadOlder}
            disabled={loadingOlder}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {loadingOlder ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </>
            ) : (
              "Load older messages"
            )}
          </button>
        </div>
      )}

      {/* Message groups by date */}
      {groups.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-medium text-muted-foreground">
              {group.label}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Messages */}
          {group.messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}

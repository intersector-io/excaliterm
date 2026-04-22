import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { formatRelativeTime } from "@/lib/format-time";
import type { ChatMessageItem } from "@/stores/chat-store";

interface ChatMessageProps {
  message: ChatMessageItem;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ChatMessage({ message }: ChatMessageProps) {
  const initials = useMemo(() => getInitials(message.displayName), [message.displayName]);
  const relativeTime = useMemo(() => formatRelativeTime(message.createdAt), [message.createdAt]);

  return (
    <div className="group flex gap-2.5 px-3 py-1.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-caption font-semibold text-secondary-foreground mt-0.5">
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-foreground">
            {message.displayName}
          </span>
          <span className="text-caption text-muted-foreground">
            {relativeTime}
          </span>
        </div>

        <div className="chat-markdown mt-0.5 text-sm text-foreground/90">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

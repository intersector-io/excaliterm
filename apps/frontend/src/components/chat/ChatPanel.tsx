import { X, MessageSquare } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const { messages, sendMessage, loadOlder, loadingOlder, hasMore, isLoading } =
    useChat(open);

  return (
    <div
      className={`flex h-full w-80 shrink-0 flex-col border-l border-border-default bg-card transition-transform duration-200 ease-in-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ marginRight: open ? 0 : -320 }}
    >
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-default px-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-body-sm font-medium text-foreground">Chat</span>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="relative flex-1 overflow-hidden">
        {/* Scroll shadow at top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-card to-transparent" />
        <ChatMessageList
          messages={messages}
          isLoading={isLoading}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          onLoadOlder={loadOlder}
        />
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} />
    </div>
  );
}

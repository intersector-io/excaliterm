import { MessageSquare } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";

interface ChatViewProps {
  isActive: boolean;
}

export function ChatView({ isActive }: ChatViewProps) {
  const { messages, sendMessage, loadOlder, loadingOlder, hasMore, isLoading } =
    useChat(isActive);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Chat</span>
      </div>

      {/* Message list */}
      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        onLoadOlder={loadOlder}
      />

      {/* Input */}
      <ChatInput onSend={sendMessage} />
    </div>
  );
}

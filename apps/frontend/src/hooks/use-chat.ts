import { useEffect, useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getChatHub } from "@/lib/signalr-client";
import * as api from "@/lib/api-client";
import { useChatStore, type ChatMessageItem } from "@/stores/chat-store";
import { useWorkspace } from "@/hooks/use-workspace";

const PAGE_SIZE = 50;

interface SignalRChatMessage {
  id: string;
  userName: string;
  workspaceId: string;
  content: string;
  timestamp: number;
}

interface ApiChatMessage {
  id: string;
  displayName: string;
  content: string;
  createdAt: string;
}

function toMessageItem(m: ApiChatMessage): ChatMessageItem {
  return { id: m.id, displayName: m.displayName, content: m.content, createdAt: m.createdAt };
}

export function useChat(isActive: boolean) {
  const { workspaceId } = useWorkspace();
  const {
    messages,
    setMessages,
    addMessage,
    appendOlderMessages,
    resetUnread,
    incrementUnread,
  } = useChatStore();

  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const historyQuery = useQuery({
    queryKey: ["chat-history", workspaceId],
    queryFn: () => api.getChatHistory(workspaceId, PAGE_SIZE, 0),
  });

  useEffect(() => {
    if (historyQuery.data) {
      setMessages(historyQuery.data.messages.map(toMessageItem));
      setHasMore(historyQuery.data.messages.length >= PAGE_SIZE);
    }
  }, [historyQuery.data, setMessages]);

  useEffect(() => {
    const chatHub = getChatHub();

    function handleReceiveMessage(msg: SignalRChatMessage) {
      const item: ChatMessageItem = {
        id: msg.id,
        displayName: msg.userName,
        content: msg.content,
        createdAt: new Date(msg.timestamp).toISOString(),
      };
      addMessage(item);

      if (!isActiveRef.current) {
        incrementUnread();
      }
    }

    chatHub.on("ReceiveMessage", handleReceiveMessage);
    return () => {
      chatHub.off("ReceiveMessage", handleReceiveMessage);
    };
  }, [addMessage, incrementUnread]);

  useEffect(() => {
    if (isActive) {
      resetUnread();
    }
  }, [isActive, resetUnread]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const chatHub = getChatHub();
      await chatHub.invoke("SendMessage", trimmed);
    },
    [],
  );

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const offset = messages.length;
      const data = await api.getChatHistory(workspaceId, PAGE_SIZE, offset);
      appendOlderMessages(data.messages.map(toMessageItem));
      setHasMore(data.messages.length >= PAGE_SIZE);
    } finally {
      setLoadingOlder(false);
    }
  }, [messages.length, loadingOlder, hasMore, appendOlderMessages, workspaceId]);

  return {
    messages,
    sendMessage,
    loadOlder,
    loadingOlder,
    hasMore,
    isLoading: historyQuery.isLoading,
  };
}

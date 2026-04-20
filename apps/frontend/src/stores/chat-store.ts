import { create } from "zustand";

export interface ChatMessageItem {
  id: string;
  displayName: string;
  content: string;
  createdAt: string;
}

interface ChatStore {
  messages: ChatMessageItem[];
  unreadCount: number;
  setMessages: (messages: ChatMessageItem[]) => void;
  addMessage: (message: ChatMessageItem) => void;
  appendOlderMessages: (messages: ChatMessageItem[]) => void;
  resetUnread: () => void;
  incrementUnread: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  unreadCount: 0,

  setMessages: (messages) => {
    set({ messages: [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
  },

  addMessage: (message) => {
    set((state) => {
      // Avoid duplicates
      if (state.messages.some((m) => m.id === message.id)) return state;
      return { messages: [...state.messages, message] };
    });
  },

  appendOlderMessages: (messages) => {
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));
      const combined = [...newMessages, ...state.messages];
      combined.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { messages: combined };
    });
  },

  resetUnread: () => {
    set({ unreadCount: 0 });
  },

  incrementUnread: () => {
    set((state) => ({ unreadCount: state.unreadCount + 1 }));
  },
}));

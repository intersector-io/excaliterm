import { useState, useCallback, useRef } from "react";
import { copyToClipboard } from "@/lib/clipboard";

export function useCopyWithFeedback(resetMs = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback(
    async (text: string, key: string) => {
      await copyToClipboard(text);
      setCopiedKey(key);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedKey(null), resetMs);
    },
    [resetMs],
  );

  const isCopied = useCallback(
    (key: string) => copiedKey === key,
    [copiedKey],
  );

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setCopiedKey(null);
  }, []);

  return { copy, isCopied, reset };
}

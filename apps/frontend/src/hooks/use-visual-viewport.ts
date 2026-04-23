import { useState, useEffect } from "react";

/**
 * Tracks the visual viewport height, which shrinks when the iOS/Android
 * software keyboard opens. Returns the current height in pixels.
 * Falls back to window.innerHeight when the API is unavailable.
 */
export function useVisualViewportHeight(): number {
  const [height, setHeight] = useState(
    () => globalThis.visualViewport?.height ?? globalThis.innerHeight,
  );

  useEffect(() => {
    const vv = globalThis.visualViewport;
    if (!vv) return;

    function handleResize() {
      setHeight(vv!.height);
    }

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  return height;
}

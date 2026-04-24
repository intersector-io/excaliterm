import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

function triggerHaptic(ms: number) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

interface HoldButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  onFire: () => void;
  repeatable?: boolean;
  haptic?: number;
  initialDelay?: number;
  repeatInterval?: number;
  children?: ReactNode;
}

// Fires onFire on press-down (low-latency). When repeatable, holds the key
// to repeat at a natural keyboard cadence. Adds haptic feedback when available.
export function HoldButton({
  onFire,
  repeatable = false,
  haptic = 5,
  initialDelay = 400,
  repeatInterval = 60,
  children,
  ...props
}: HoldButtonProps) {
  const fnRef = useRef(onFire);
  fnRef.current = onFire;
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (delayTimer.current) {
      clearTimeout(delayTimer.current);
      delayTimer.current = null;
    }
    if (intervalTimer.current) {
      clearInterval(intervalTimer.current);
      intervalTimer.current = null;
    }
  };

  const start = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Prevent the synthetic click after a touch so we don't double-fire.
    e.preventDefault();
    triggerHaptic(haptic);
    fnRef.current();
    if (!repeatable) return;
    delayTimer.current = setTimeout(() => {
      intervalTimer.current = setInterval(() => fnRef.current(), repeatInterval);
    }, initialDelay);
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      {...props}
    >
      {children}
    </button>
  );
}

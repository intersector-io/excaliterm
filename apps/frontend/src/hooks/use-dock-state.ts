import { useSyncExternalStore } from "react";

const STORAGE_KEY = "excaliterm:terminal-dock-collapsed";
const listeners = new Set<() => void>();
let collapsed = readInitial();

function readInitial(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setDockCollapsed(value: boolean | ((prev: boolean) => boolean)) {
  const next = typeof value === "function" ? value(collapsed) : value;
  if (next === collapsed) return;
  collapsed = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // ignore storage failures (private mode, quota)
  }
  for (const l of listeners) l();
}

export function useDockCollapsed(): boolean {
  return useSyncExternalStore(subscribe, () => collapsed, () => collapsed);
}

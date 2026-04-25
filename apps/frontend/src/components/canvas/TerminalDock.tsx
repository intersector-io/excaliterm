import { useState, useMemo, useCallback, useRef } from "react";
import { ChevronUp, ChevronDown, Search, Tag, Server, X, Terminal } from "lucide-react";
import { useTerminals } from "@/hooks/use-terminal";
import { useServices } from "@/hooks/use-services";
import { useCanvas, type TerminalNodeData } from "@/hooks/use-canvas";
import { useDockCollapsed, setDockCollapsed } from "@/hooks/use-dock-state";
import { getStatusDotColor, getStatusLabel } from "@/lib/terminal-status";
import { groupTerminals, type GroupMode } from "@/lib/terminal-grouping";
import { getTagColor } from "./TagEditor";
import type { TerminalSession } from "@excaliterm/shared-types";

interface TerminalDockProps {
  onFocusTerminal: (nodeId: string) => void;
  onFullScreenTerminal: (terminalId: string, status: string) => void;
}

/* ─── Skeleton Card ──────────────────────────────────────────────────────── */

function TerminalSkeleton({
  terminal,
  onClick,
  onDoubleClick,
}: Readonly<{
  terminal: TerminalSession;
  onClick: () => void;
  onDoubleClick: () => void;
}>) {
  const tags = terminal.tags ?? [];
  const statusDot = getStatusDotColor(terminal.status);
  const statusText = getStatusLabel(terminal.status);
  const isActive = terminal.status === "active";

  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={`${terminal.id.slice(0, 8)} — ${statusText}. Double-click to fullscreen.`}
      className={`group relative flex w-[108px] shrink-0 flex-col gap-1 overflow-hidden rounded-lg border p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all active:scale-[0.97] ${
        isActive
          ? "border-border-subtle/70 bg-surface-sunken/90 hover:border-accent-cyan/30 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_12px_rgba(34,211,238,0.06)]"
          : "border-border-subtle/40 bg-surface-sunken/50 opacity-70 hover:opacity-90 hover:border-border-subtle/60"
      }`}
    >
      {/* Faux terminal lines */}
      <div className="pointer-events-none absolute inset-x-1.5 bottom-1.5 top-[26px] flex flex-col gap-[3px] overflow-hidden opacity-[0.06]">
        <div className="h-[2px] w-[70%] rounded-full bg-foreground" />
        <div className="h-[2px] w-[55%] rounded-full bg-foreground" />
        <div className="h-[2px] w-[85%] rounded-full bg-foreground" />
        <div className="h-[2px] w-[40%] rounded-full bg-foreground" />
      </div>

      {/* Title row */}
      <div className="relative flex items-center gap-1">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot} ${
            isActive ? "animate-pulse" : ""
          }`}
        />
        <span className="truncate font-mono text-[9px] leading-none text-muted-foreground/70 group-hover:text-foreground/80">
          {terminal.id.slice(0, 8)}
        </span>
      </div>

      {/* Tags */}
      <div className="relative flex min-h-[14px] flex-wrap gap-0.5">
        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className={`rounded-full border px-1 text-[8px] font-medium leading-[14px] ${getTagColor(tag)}`}
          >
            {tag}
          </span>
        ))}
        {tags.length > 3 && (
          <span className="text-[8px] leading-[14px] text-muted-foreground/40">
            +{tags.length - 3}
          </span>
        )}
        {tags.length === 0 && (
          <span className="flex items-center gap-0.5 text-[8px] leading-[14px] text-muted-foreground/35">
            <Terminal className="h-2 w-2" />
            shell
          </span>
        )}
      </div>
    </button>
  );
}

/* ─── Main Dock ──────────────────────────────────────────────────────────── */

export function TerminalDock({
  onFocusTerminal,
  onFullScreenTerminal,
}: Readonly<TerminalDockProps>) {
  const { terminals } = useTerminals();
  const { services } = useServices();
  const { nodes } = useCanvas();

  const collapsed = useDockCollapsed();
  const [groupMode, setGroupMode] = useState<GroupMode>("tag");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const terminalNodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      if (n.type === "terminal") {
        map.set((n.data as TerminalNodeData).terminalId, n.id);
      }
    }
    return map;
  }, [nodes]);

  // Only show terminals that have a canvas node. Orphaned session records
  // (node deleted but record lingering) must not appear in the dock.
  const visibleTerminals = useMemo(
    () => terminals.filter((t) => terminalNodeMap.has(t.id)),
    [terminals, terminalNodeMap],
  );

  const filteredTerminals = useMemo(() => {
    if (collapsed || !search.trim()) return collapsed ? [] : visibleTerminals;
    const tokens = search.toLowerCase().split(/\s+/);
    return visibleTerminals.filter((t) => {
      const text = `${t.id} ${(t.tags ?? []).join(" ")}`.toLowerCase();
      return tokens.every((tok) => text.includes(tok));
    });
  }, [visibleTerminals, search, collapsed]);

  const groups = useMemo(
    () => (collapsed ? [] : groupTerminals(filteredTerminals, groupMode, services)),
    [filteredTerminals, groupMode, services, collapsed],
  );

  const handleClickSkeleton = useCallback(
    (terminalId: string) => {
      const nodeId = terminalNodeMap.get(terminalId);
      if (nodeId) onFocusTerminal(nodeId);
    },
    [terminalNodeMap, onFocusTerminal],
  );

  if (visibleTerminals.length === 0) return null;

  const showFilterCount = filteredTerminals.length !== visibleTerminals.length;
  const activeCount = visibleTerminals.filter((t) => t.status === "active").length;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col">
      {/* Collapse toggle tab */}
      <div className="flex justify-center">
        <button
          onClick={() => setDockCollapsed((v) => !v)}
          className="flex h-6 items-center gap-2 rounded-t-lg border border-b-0 border-border-default/40 bg-card/85 px-3.5 shadow-[0_-2px_8px_rgba(0,0,0,0.15)] backdrop-blur-md transition-colors hover:bg-card/95 hover:text-muted-foreground"
        >
          {collapsed ? (
            <ChevronUp className="h-2.5 w-2.5 text-muted-foreground/50" />
          ) : (
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/50" />
          )}
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {activeCount > 0 && (
              <span className="mr-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-green/15 px-1 text-[9px] font-semibold text-accent-green">
                {activeCount}
              </span>
            )}
            {visibleTerminals.length} terminal{visibleTerminals.length !== 1 ? "s" : ""}
          </span>
        </button>
      </div>

      {/* Dock body */}
      {!collapsed && (
        <div className="border-t border-border-default/40 bg-card/85 shadow-[0_-4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md transition-all">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex items-center gap-1.5 rounded-md border border-border-subtle/60 bg-surface-sunken/50 px-2 py-1 transition-colors focus-within:border-accent-cyan/25">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              <input
                ref={searchRef}
                name="terminal-dock-search"
                aria-label="Find terminal"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find terminal..."
                className="w-28 bg-transparent text-caption text-foreground outline-none placeholder:text-muted-foreground/30"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  className="text-muted-foreground/40 transition-colors hover:text-muted-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>

            <div className="flex overflow-hidden rounded-md border border-border-subtle/60">
              <button
                onClick={() => setGroupMode("tag")}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                  groupMode === "tag"
                    ? "bg-accent-cyan/12 text-accent-cyan"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                }`}
              >
                <Tag className="h-2.5 w-2.5" />
                Tag
              </button>
              <button
                onClick={() => setGroupMode("host")}
                className={`flex items-center gap-1 border-l border-border-subtle/60 px-2 py-1 text-[10px] font-medium transition-colors ${
                  groupMode === "host"
                    ? "bg-accent-cyan/12 text-accent-cyan"
                    : "text-muted-foreground/60 hover:text-muted-foreground"
                }`}
              >
                <Server className="h-2.5 w-2.5" />
                Host
              </button>
            </div>

            <span className="ml-auto font-mono text-[10px] text-muted-foreground/30">
              {showFilterCount && `${filteredTerminals.length}/`}
              {terminals.length}
            </span>
          </div>

          {/* Groups */}
          <div className="flex gap-5 overflow-x-auto px-3 pb-2.5 pt-0.5">
            {groups.length === 0 ? (
              <div className="flex w-full items-center justify-center gap-2 py-4 text-caption text-muted-foreground/40">
                <Search className="h-3.5 w-3.5" />
                No matching terminals
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.key} className="shrink-0">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    {group.colorClasses ? (
                      <span
                        className={`inline-block rounded-full border px-1.5 text-[9px] font-medium leading-[14px] ${group.colorClasses}`}
                      >
                        {group.label}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                        {group.label}
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground/25">
                      {group.terminals.length}
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    {group.terminals.map((t) => (
                      <TerminalSkeleton
                        key={t.id}
                        terminal={t}
                        onClick={() => handleClickSkeleton(t.id)}
                        onDoubleClick={() =>
                          onFullScreenTerminal(t.id, t.status)
                        }
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

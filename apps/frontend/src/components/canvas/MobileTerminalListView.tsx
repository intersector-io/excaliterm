import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Terminal,
  StickyNote,
  Plus,
  Server,
  Users,
  Focus,
  Filter,
  X,
} from "lucide-react";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useServices } from "@/hooks/use-services";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { MobileMediaSection } from "./MobileMediaViewer";
import * as api from "@/lib/api-client";
import { TerminalFullScreen } from "@/components/terminal/TerminalFullScreen";
import { getTagColor } from "./TagEditor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { RegisterServiceDialog } from "@/components/services/RegisterServiceDialog";
import type { TerminalStatus } from "@excaliterm/shared-types";

const ALL_STATUSES: TerminalStatus[] = [
  "active",
  "disconnected",
  "exited",
  "error",
];

export function MobileTerminalListView() {
  const { terminals, createTerminal, isCreating } = useTerminals();
  const { createNote, isCreating: isCreatingNote } = useNotes();
  const { onlineCount } = useServices();
  const { collaborator, workspaceId, apiKey } = useWorkspace();
  const { collaboratorCount } = useTerminalCollaboration();

  const noHost = onlineCount === 0;
  const [connectOpen, setConnectOpen] = useState(false);

  const screenshotsQuery = useQuery({
    queryKey: ["screenshots", workspaceId],
    queryFn: () => api.listScreenshots(workspaceId),
  });
  const screenshots = screenshotsQuery.data?.screenshots ?? [];

  const [fullScreenTerminal, setFullScreenTerminal] = useState<{
    terminalId: string;
    status: TerminalStatus;
    tags?: string[];
  } | null>(null);

  // ── Filter state ──────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<TerminalStatus>>(
    new Set(),
  );
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const t of terminals) {
      for (const tag of t.tags ?? []) tags.add(tag);
    }
    return Array.from(tags).sort();
  }, [terminals]);

  const hasFilters = selectedStatuses.size > 0 || selectedTags.size > 0;

  const filteredTerminals = useMemo(() => {
    if (!hasFilters) return terminals;
    return terminals.filter((t) => {
      if (
        selectedStatuses.size > 0 &&
        !selectedStatuses.has(t.status as TerminalStatus)
      )
        return false;
      if (selectedTags.size > 0) {
        const tTags = t.tags ?? [];
        if (!tTags.some((tag) => selectedTags.has(tag))) return false;
      }
      return true;
    });
  }, [terminals, selectedStatuses, selectedTags, hasFilters]);

  const activeTerminals = useMemo(
    () => filteredTerminals.filter((t) => t.status === "active"),
    [filteredTerminals],
  );
  const inactiveTerminals = useMemo(
    () => filteredTerminals.filter((t) => t.status !== "active"),
    [filteredTerminals],
  );

  const toggleStatus = useCallback((s: TerminalStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedStatuses(new Set());
    setSelectedTags(new Set());
  }, []);

  // ── Fullscreen / focus helpers ────────────────────────────────────────
  const handleOpenTerminal = useCallback(
    (terminalId: string, status: TerminalStatus, tags?: string[]) => {
      setFullScreenTerminal({ terminalId, status, tags });
    },
    [],
  );

  const enterFocusMode = useCallback(() => {
    const first = filteredTerminals[0];
    if (first) {
      setFullScreenTerminal({
        terminalId: first.id,
        status: first.status as TerminalStatus,
        tags: first.tags,
      });
    }
  }, [filteredTerminals]);

  async function handleNewTerminal() {
    if (noHost) {
      toast.error("No host available", {
        description: "Register and connect a service first.",
      });
      return;
    }
    try {
      await createTerminal({});
      toast.success("Terminal created");
    } catch {
      toast.error("Failed to create terminal");
    }
  }

  async function handleNewNote() {
    try {
      await createNote({});
      toast.success("Note created on canvas");
    } catch {
      toast.error("Failed to create note");
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-accent-green";
      case "error":
        return "bg-accent-red";
      case "disconnected":
        return "bg-accent-amber";
      default:
        return "bg-muted-foreground/40";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Live";
      case "error":
        return "Error";
      case "disconnected":
        return "Offline";
      case "exited":
        return "Exited";
      default:
        return status;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div>
          <h1 className="text-body font-semibold text-foreground">Terminals</h1>
          <div className="mt-0.5 flex items-center gap-3 text-caption text-muted-foreground">
            <span className="truncate">{collaborator.displayName}</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {collaboratorCount}
            </span>
            <span
              className={`flex items-center gap-1 ${noHost ? "text-accent-amber" : "text-accent-green"}`}
            >
              <Server className="h-3 w-3" />
              {noHost ? "No host" : `${onlineCount} host`}
            </span>
          </div>
        </div>
        {/* Focus + Filter buttons */}
        {terminals.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-caption font-medium transition-colors ${
                filterOpen || hasFilters
                  ? "bg-accent-cyan/15 text-accent-cyan"
                  : "bg-surface-raised text-muted-foreground"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              {hasFilters && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-cyan text-[10px] font-bold text-background">
                  {selectedStatuses.size + selectedTags.size}
                </span>
              )}
            </button>
            <button
              onClick={enterFocusMode}
              disabled={filteredTerminals.length === 0}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-accent-cyan/12 px-2.5 text-caption font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/20 disabled:opacity-40"
            >
              <Focus className="h-3.5 w-3.5" />
              Focus
            </button>
          </div>
        )}
      </div>

      {/* Filter bar */}
      {filterOpen && terminals.length > 0 && (
        <div className="border-b border-border-default bg-surface-sunken/30 px-4 py-2.5 space-y-2">
          {/* Status filters */}
          <div className="space-y-1">
            <span className="text-caption font-medium uppercase tracking-wider text-muted-foreground/50">
              Status
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-medium transition-colors ${
                    selectedStatuses.has(s)
                      ? `${statusColor(s)}/20 ${statusColor(s).replace("bg-", "text-")} border-current`
                      : "border-border/40 text-muted-foreground"
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${statusColor(s)}`}
                  />
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filters */}
          {allTags.length > 0 && (
            <div className="space-y-1">
              <span className="text-caption font-medium uppercase tracking-wider text-muted-foreground/50">
                Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-2.5 py-1 text-caption font-medium transition-colors ${
                      selectedTags.has(tag)
                        ? getTagColor(tag)
                        : "border-border/40 text-muted-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-caption text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear filters
              <span className="text-muted-foreground/40">
                ({filteredTerminals.length} of {terminals.length})
              </span>
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {terminals.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-accent-cyan/15 bg-accent-cyan/[0.06]">
              <Terminal className="h-6 w-6 text-accent-cyan/70" strokeWidth={1.5} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-body font-semibold text-foreground">
                {noHost ? "Connect a host" : "No terminals yet"}
              </h2>
              <p className="text-body-sm leading-relaxed text-muted-foreground">
                {noHost
                  ? "Connect a host to start creating terminal sessions."
                  : "Create your first terminal session to get started."}
              </p>
            </div>
            {noHost ? (
              <Button
                onClick={() => setConnectOpen(true)}
                className="gap-2 rounded-xl border border-accent-cyan/20 bg-accent-cyan/12 text-accent-cyan"
              >
                <Server className="h-4 w-4" />
                Connect a host
              </Button>
            ) : (
              <Button
                onClick={handleNewTerminal}
                disabled={isCreating}
                className="gap-2 rounded-xl border border-accent-cyan/20 bg-accent-cyan/12 text-accent-cyan"
              >
                <Terminal className="h-4 w-4" />
                {isCreating ? "Creating..." : "New Terminal"}
              </Button>
            )}
          </div>
        ) : filteredTerminals.length === 0 ? (
          /* No matches */
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <Filter className="h-8 w-8 text-muted-foreground/30" />
            <div className="space-y-1">
              <h2 className="text-body font-semibold text-foreground">
                No matching terminals
              </h2>
              <p className="text-body-sm text-muted-foreground">
                Try adjusting your filters.
              </p>
            </div>
            <button
              onClick={clearFilters}
              className="text-body-sm font-medium text-accent-cyan"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {/* Active terminals */}
            {activeTerminals.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="px-1 text-caption font-medium uppercase tracking-wider text-muted-foreground/60">
                  Active ({activeTerminals.length})
                </h3>
                {activeTerminals.map((terminal) => (
                  <TerminalCard
                    key={terminal.id}
                    terminalId={terminal.id}
                    status={terminal.status}
                    tags={terminal.tags}
                    exitCode={terminal.exitCode}
                    statusColor={statusColor(terminal.status)}
                    statusLabel={statusLabel(terminal.status)}
                    onTap={() =>
                      handleOpenTerminal(
                        terminal.id,
                        terminal.status as TerminalStatus,
                        terminal.tags,
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* Inactive terminals */}
            {inactiveTerminals.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="px-1 text-caption font-medium uppercase tracking-wider text-muted-foreground/60">
                  Inactive ({inactiveTerminals.length})
                </h3>
                {inactiveTerminals.map((terminal) => (
                  <TerminalCard
                    key={terminal.id}
                    terminalId={terminal.id}
                    status={terminal.status}
                    tags={terminal.tags}
                    exitCode={terminal.exitCode}
                    statusColor={statusColor(terminal.status)}
                    statusLabel={statusLabel(terminal.status)}
                    onTap={() =>
                      handleOpenTerminal(
                        terminal.id,
                        terminal.status as TerminalStatus,
                        terminal.tags,
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* Media: Screenshots & Streams */}
            <MobileMediaSection screenshots={screenshots} />
          </div>
        )}
      </div>

      {/* FAB */}
      {terminals.length > 0 && (
        <div className="absolute bottom-20 right-4 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full bg-accent-cyan text-background shadow-lg hover:bg-accent-cyan/90"
                disabled={isCreating || isCreatingNote}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end">
              <DropdownMenuItem
                onClick={handleNewTerminal}
                disabled={isCreating || noHost}
              >
                <Terminal className="h-4 w-4" />
                <span>
                  {noHost
                    ? "No host connected"
                    : isCreating
                      ? "Creating..."
                      : "New Terminal"}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleNewNote}
                disabled={isCreatingNote}
              >
                <StickyNote className="h-4 w-4" />
                <span>{isCreatingNote ? "Creating..." : "New Note"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <RegisterServiceDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        workspaceId={workspaceId}
        apiKey={apiKey}
      />

      {/* Fullscreen terminal overlay — cycles through filtered terminals */}
      {fullScreenTerminal && (
        <TerminalFullScreen
          terminalId={fullScreenTerminal.terminalId}
          status={fullScreenTerminal.status}
          tags={fullScreenTerminal.tags}
          onBack={() => setFullScreenTerminal(null)}
          currentIndex={filteredTerminals.findIndex(
            (t) => t.id === fullScreenTerminal.terminalId,
          )}
          totalCount={filteredTerminals.length}
          onPrev={() => {
            const idx = filteredTerminals.findIndex(
              (t) => t.id === fullScreenTerminal.terminalId,
            );
            const prev =
              filteredTerminals[
                (idx - 1 + filteredTerminals.length) % filteredTerminals.length
              ];
            if (prev)
              setFullScreenTerminal({
                terminalId: prev.id,
                status: prev.status as TerminalStatus,
                tags: prev.tags,
              });
          }}
          onNext={() => {
            const idx = filteredTerminals.findIndex(
              (t) => t.id === fullScreenTerminal.terminalId,
            );
            const next =
              filteredTerminals[(idx + 1) % filteredTerminals.length];
            if (next)
              setFullScreenTerminal({
                terminalId: next.id,
                status: next.status as TerminalStatus,
                tags: next.tags,
              });
          }}
        />
      )}
    </div>
  );
}

/* ─── Terminal Card ───────────────────────────────────────────────────────── */

function TerminalCard({
  terminalId,
  status,
  tags,
  exitCode,
  statusColor,
  statusLabel,
  onTap,
}: {
  terminalId: string;
  status: string;
  tags?: string[];
  exitCode?: number | null;
  statusColor: string;
  statusLabel: string;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="flex w-full items-center gap-3 rounded-xl border border-border-default bg-surface-raised/60 px-4 py-3 text-left transition-all active:scale-[0.98] active:bg-surface-raised"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-sunken/50">
        <Terminal className="h-4.5 w-4.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-body-sm font-medium text-foreground">
            {terminalId.slice(0, 8)}
          </span>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full ${statusColor} ${status === "active" ? "animate-pulse" : ""}`}
            />
            <span className="text-caption text-muted-foreground">
              {statusLabel}
            </span>
          </div>
        </div>
        {(tags ?? []).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags!.map((tag) => (
              <span
                key={tag}
                className={`rounded-full border px-1.5 py-0 text-caption font-medium ${getTagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {exitCode !== null && exitCode !== undefined && (
          <span className="mt-0.5 text-caption text-muted-foreground/60">
            exit {exitCode}
          </span>
        )}
      </div>
      <ChevronIcon />
    </button>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-muted-foreground/40"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

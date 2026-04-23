import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  Terminal,
  StickyNote,
  Plus,
  Users,
  Filter,
  X,
  Tag,
  Server,
  Layers,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useTerminals } from "@/hooks/use-terminal";
import { useNotes } from "@/hooks/use-notes";
import { useServices } from "@/hooks/use-services";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import { getStatusDotColor, getStatusLabel } from "@/lib/terminal-status";
import { groupTerminals, type GroupMode } from "@/lib/terminal-grouping";
import { MobileMediaSection } from "./MobileMediaViewer";
import { MobileNotesSection } from "./MobileNotesSection";
import { MobileHostsSection } from "./MobileHostsSection";
import * as api from "@/lib/api-client";
import { TerminalFullScreen } from "@/components/terminal/TerminalFullScreen";
import { getTagColor, getTagBorderColor } from "./TagEditor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TagEditor } from "./TagEditor";
import type { TerminalStatus } from "@excaliterm/shared-types";

const ALL_STATUSES: TerminalStatus[] = [
  "active",
  "disconnected",
  "exited",
  "error",
];

const GROUP_MODE_ICONS: Record<GroupMode, typeof Layers> = {
  status: Layers,
  tag: Tag,
  host: Server,
};

export function MobileTerminalListView() {
  const { terminals, createTerminal, updateTerminal, deleteTerminal, isCreating } = useTerminals();
  const { createNote, isCreating: isCreatingNote } = useNotes();
  const { services, onlineCount } = useServices();
  const { collaborator, workspaceId } = useWorkspace();
  const { collaboratorCount } = useTerminalCollaboration();

  const noHost = onlineCount === 0;

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
  const [groupMode, setGroupMode] = useState<GroupMode>("status");

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const t of terminals) {
      for (const tag of t.tags ?? []) tags.add(tag);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [terminals]);

  const hasFilters = selectedStatuses.size > 0 || selectedTags.size > 0;

  const filteredTerminals = useMemo(() => {
    if (selectedStatuses.size === 0 && selectedTags.size === 0) return terminals;
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
  }, [terminals, selectedStatuses, selectedTags]);

  const groups = useMemo(
    () => groupTerminals(filteredTerminals, groupMode, services),
    [filteredTerminals, groupMode, services],
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

  const GroupIcon = GROUP_MODE_ICONS[groupMode];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div>
          <h1 className="text-body font-semibold text-foreground">Terminals</h1>
          <div className="mt-1 flex items-center gap-2 text-caption">
            <span className="truncate text-muted-foreground/70">
              {collaborator.displayName}
            </span>
            <span className="text-border-default">|</span>
            <span className="flex items-center gap-1 text-muted-foreground/70">
              <Users className="h-3 w-3" />
              {collaboratorCount}
            </span>
            <span className="text-border-default">|</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-medium ${
                noHost
                  ? "bg-accent-amber/10 text-accent-amber"
                  : "bg-accent-green/10 text-accent-green"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  noHost ? "bg-accent-amber" : "bg-accent-green animate-pulse"
                }`}
              />
              {noHost ? "No host" : `${onlineCount} online`}
            </span>
          </div>
        </div>
        {/* Focus + Filter + Group buttons */}
        {terminals.length > 0 && (
          <div className="flex items-center gap-1.5">
            {/* Group mode toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-raised px-2.5 text-caption font-medium text-muted-foreground"
                >
                  <GroupIcon className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setGroupMode("status")}>
                  <Layers className="h-3.5 w-3.5" />
                  <span>By status</span>
                  {groupMode === "status" && <span className="ml-auto text-accent-cyan">*</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGroupMode("tag")}>
                  <Tag className="h-3.5 w-3.5" />
                  <span>By tag</span>
                  {groupMode === "tag" && <span className="ml-auto text-accent-cyan">*</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGroupMode("host")}>
                  <Server className="h-3.5 w-3.5" />
                  <span>By host</span>
                  {groupMode === "host" && <span className="ml-auto text-accent-cyan">*</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                      ? `${getStatusDotColor(s)}/20 ${getStatusDotColor(s).replace("bg-", "text-")} border-current`
                      : "border-border/40 text-muted-foreground"
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${getStatusDotColor(s)}`}
                  />
                  {getStatusLabel(s)}
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
        {/* Hosts section — always visible at top */}
        <div className="p-3 pb-0">
          <MobileHostsSection />
        </div>

        {terminals.length === 0 && !noHost && (
          <div className="flex flex-col items-center justify-center gap-5 px-6 py-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-accent-cyan/15 bg-accent-cyan/[0.06]">
              <Terminal className="h-9 w-9 text-accent-cyan/70" strokeWidth={1.5} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">
                No terminals yet
              </h2>
              <p className="text-body-sm leading-relaxed text-muted-foreground/80">
                Your host is connected. Create your first terminal session.
              </p>
            </div>
            <Button
              onClick={handleNewTerminal}
              disabled={isCreating}
              className="h-11 w-full max-w-[280px] gap-2 rounded-xl bg-accent-cyan text-background font-medium transition-all active:scale-[0.98]"
            >
              <Terminal className="h-4 w-4" />
              {isCreating ? "Creating..." : "New Terminal"}
            </Button>
          </div>
        )}
        {terminals.length > 0 && filteredTerminals.length === 0 ? (
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
            {groups.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 px-1 text-caption font-medium uppercase tracking-wider text-muted-foreground/60">
                  {group.colorClasses ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0 text-caption font-medium normal-case tracking-normal ${group.colorClasses}`}
                    >
                      {group.label}
                    </span>
                  ) : (
                    <span>{group.label}</span>
                  )}
                  <span className={`text-muted-foreground/30 ${group.colorClasses ? "text-[10px]" : ""}`}>
                    {group.terminals.length}
                  </span>
                </h3>
                {group.terminals.map((terminal) => (
                  <TerminalCard
                    key={terminal.id}
                    terminalId={terminal.id}
                    status={terminal.status}
                    tags={terminal.tags}
                    exitCode={terminal.exitCode}
                    statusColor={getStatusDotColor(terminal.status)}
                    statusLabel={getStatusLabel(terminal.status)}
                    onTap={() =>
                      handleOpenTerminal(
                        terminal.id,
                        terminal.status as TerminalStatus,
                        terminal.tags,
                      )
                    }
                    onTagsChange={(tags) =>
                      updateTerminal({ id: terminal.id, data: { tags } })
                    }
                    onDismiss={() => deleteTerminal(terminal.id)}
                  />
                ))}
              </div>
            ))}

            {/* Notes */}
            <MobileNotesSection />

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
                    : (isCreating ? "Creating..." : "New Terminal")}
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
  onTagsChange,
  onDismiss,
}: Readonly<{
  terminalId: string;
  status: string;
  tags?: string[];
  exitCode?: number | null;
  statusColor: string;
  statusLabel: string;
  onTap: () => void;
  onTagsChange: (tags: string[]) => void;
  onDismiss: () => void;
}>) {
  const [showTagEditor, setShowTagEditor] = useState(false);

  return (
    <div
      className={`rounded-xl border border-border-default border-l-[3px] bg-surface-raised/60 transition-all ${
        (tags ?? []).length > 0 ? getTagBorderColor(tags![0]!) : "border-l-border-subtle"
      }`}
    >
      {/* Main card row */}
      <div className="flex w-full items-center gap-3 px-4 py-3">
        <button
          onClick={onTap}
          className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-80"
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
        </button>

        {/* Overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors active:bg-surface-raised active:text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowTagEditor((v) => !v)}>
              <Tag className="h-3.5 w-3.5" />
              <span>Edit Tags</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onDismiss();
                toast.success(status === "active" ? "Terminal closed" : "Terminal dismissed");
              }}
              className="text-accent-red focus:text-accent-red"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{status === "active" ? "Close Terminal" : "Dismiss"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Inline tag editor */}
      {showTagEditor && (
        <div className="border-t border-border-subtle/50 px-4 py-2">
          <TagEditor
            tags={tags ?? []}
            onTagsChange={onTagsChange}
          />
        </div>
      )}
    </div>
  );
}


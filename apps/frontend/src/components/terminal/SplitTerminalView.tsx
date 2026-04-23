import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTerminals } from "@/hooks/use-terminal";
import { TerminalView } from "./TerminalView";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getStatusDotColor } from "@/lib/terminal-status";
import type { TerminalStatus } from "@excaliterm/shared-types";

type SplitLayout = "horizontal" | "vertical" | "quad";

interface SplitTerminalViewProps {
  initialTerminalId?: string;
}

export function SplitTerminalView({ initialTerminalId }: Readonly<SplitTerminalViewProps>) {
  const { terminals } = useTerminals();
  const [layout, setLayout] = useState<SplitLayout>("horizontal");
  const [panes, setPanes] = useState<(string | null)[]>([
    initialTerminalId ?? null,
    null,
  ]);

  const paneCount = layout === "quad" ? 4 : 2;

  // Ensure panes array matches layout
  const activePanes = panes.slice(0, paneCount);
  while (activePanes.length < paneCount) activePanes.push(null);

  const updatePane = (index: number, terminalId: string | null) => {
    setPanes((prev) => {
      const next = [...prev];
      while (next.length < paneCount) next.push(null);
      next[index] = terminalId;
      return next;
    });
  };

  const gridClass = layout === "quad"
    ? "grid grid-cols-2 grid-rows-2"
    : layout === "horizontal"
      ? "grid grid-cols-2 grid-rows-1"
      : "grid grid-cols-1 grid-rows-2";

  return (
    <div className="flex h-full flex-col">
      {/* Layout controls */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border-subtle bg-card px-3">
        <span className="text-caption font-medium text-muted-foreground/50">Layout</span>
        <div className="flex gap-1">
          {(["horizontal", "vertical", "quad"] as SplitLayout[]).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`rounded-md px-2 py-0.5 text-caption font-medium transition-colors ${
                layout === l
                  ? "bg-accent-cyan/10 text-accent-cyan"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              {l === "horizontal" ? "H Split" : l === "vertical" ? "V Split" : "Quad"}
            </button>
          ))}
        </div>
      </div>

      {/* Panes */}
      <div className={`flex-1 gap-px bg-border-subtle ${gridClass}`}>
        {activePanes.map((terminalId, idx) => (
          <SplitPane
            key={idx}
            index={idx}
            terminalId={terminalId}
            terminals={terminals}
            onSelect={(id) => updatePane(idx, id)}
          />
        ))}
      </div>
    </div>
  );
}

function SplitPane({
  index,
  terminalId,
  terminals,
  onSelect,
}: {
  index: number;
  terminalId: string | null;
  terminals: { id: string; status: string; tags?: string[] }[];
  onSelect: (id: string | null) => void;
}) {
  const terminal = terminals.find((t) => t.id === terminalId);

  return (
    <div className="flex flex-col overflow-hidden bg-background">
      {/* Pane header with terminal selector */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border-subtle bg-card px-2">
        <span className="text-[10px] font-mono text-muted-foreground/30">{index + 1}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 rounded px-1.5 py-0.5 text-caption text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground">
              {terminal ? (
                <>
                  <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotColor(terminal.status)}`} />
                  <span className="font-mono">{terminal.id.slice(0, 8)}</span>
                </>
              ) : (
                <span className="text-muted-foreground/40">Select terminal</span>
              )}
              <ChevronDown className="h-3 w-3 opacity-40" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {terminals.map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => onSelect(t.id)}>
                <span className={`h-1.5 w-1.5 rounded-full ${getStatusDotColor(t.status)}`} />
                <span className="font-mono text-caption">{t.id.slice(0, 8)}</span>
                {(t.tags ?? []).length > 0 && (
                  <span className="text-caption text-muted-foreground/40">
                    {t.tags![0]}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden">
        {terminal ? (
          <TerminalView
            terminalId={terminal.id}
            status={terminal.status as TerminalStatus}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-caption text-muted-foreground/30">
            No terminal selected
          </div>
        )}
      </div>
    </div>
  );
}

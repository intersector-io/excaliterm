import { memo, useCallback, useState } from "react";
import { type NodeProps, type Node, NodeResizer, Handle, Position } from "@xyflow/react";
import { X, Copy, Check, Play, Clock, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useCommandHistoryQueries } from "@/hooks/use-command-history";
import { useCanvas, type CommandHistoryNodeData } from "@/hooks/use-canvas";
import { copyToClipboard } from "@/lib/clipboard";
import { getTerminalHub } from "@/lib/signalr-client";
import type { CommandHistory, CommandHistoryTopEntry } from "@excaliterm/shared-types";

type CommandHistoryNodeType = Node<CommandHistoryNodeData>;

type Tab = "history" | "top";

function CommandRow({
  command,
  meta,
  terminalSessionId,
}: Readonly<{
  command: string;
  meta: string;
  terminalSessionId: string;
}>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      toast.error("Failed to copy");
    });
  }, [command]);

  const handleExecute = useCallback(() => {
    const hub = getTerminalHub();
    hub.invoke("TerminalInput", terminalSessionId, command + "\r").catch(() => {
      toast.error("Failed to execute command");
    });
    toast.success("Command sent to terminal");
  }, [command, terminalSessionId]);

  return (
    <div className="group flex items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 transition-colors hover:border-border-subtle hover:bg-white/[0.03]">
      <code className="min-w-0 flex-1 truncate font-mono text-caption text-white/80">
        {command}
      </code>
      <span className="shrink-0 text-caption text-white/30">{meta}</span>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={handleCopy}
          className="nodrag nopan flex h-5 w-5 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70"
          title="Copy"
        >
          {copied ? <Check className="h-3 w-3 text-accent-green" /> : <Copy className="h-3 w-3" />}
        </button>
        <button
          onClick={handleExecute}
          className="nodrag nopan flex h-5 w-5 items-center justify-center rounded text-white/40 transition-colors hover:bg-accent-green/20 hover:text-accent-green"
          title="Execute"
        >
          <Play className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function HistoryTab({
  commands,
  terminalSessionId,
}: Readonly<{
  commands: CommandHistory[];
  terminalSessionId: string;
}>) {
  if (commands.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-caption text-white/30">
        No commands yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {commands.map((cmd) => (
        <CommandRow
          key={cmd.id}
          command={cmd.command}
          meta={new Date(cmd.executedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          terminalSessionId={terminalSessionId}
        />
      ))}
    </div>
  );
}

function TopTab({
  commands,
  terminalSessionId,
}: Readonly<{
  commands: CommandHistoryTopEntry[];
  terminalSessionId: string;
}>) {
  if (commands.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-caption text-white/30">
        No commands yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {commands.map((cmd, i) => (
        <CommandRow
          key={`${cmd.command}-${i}`}
          command={cmd.command}
          meta={`${cmd.count}x`}
          terminalSessionId={terminalSessionId}
        />
      ))}
    </div>
  );
}

function tabClass(active: boolean): string {
  const base = "flex items-center gap-1.5 px-3.5 py-2 text-caption font-medium transition-colors";
  return active
    ? `${base} text-accent-green border-b-2 border-accent-green`
    : `${base} text-white/40 hover:text-white/60`;
}

function CommandHistoryNodeComponent({ id, data, selected }: NodeProps<CommandHistoryNodeType>) {
  const { deleteNode } = useCanvas();
  const { commands, topCommands, isLoading } = useCommandHistoryQueries(data.terminalSessionId);
  const [activeTab, setActiveTab] = useState<Tab>("history");

  const handleClose = useCallback(async () => {
    try {
      await deleteNode(id);
    } catch (err) {
      console.error("Failed to close command history node:", err);
    }
  }, [id, deleteNode]);

  return (
    <>
      <NodeResizer
        minWidth={320}
        minHeight={280}
        isVisible={!!selected}
        lineClassName="!border-white/20"
        handleClassName="!w-2 !h-2 !bg-white/60 !border-0 !rounded-sm"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1.5 !h-1.5 !bg-white/40 !border-0 !rounded-sm"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1.5 !h-1.5 !bg-white/40 !border-0 !rounded-sm"
      />
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-accent-green/12 shadow-[0_12px_40px_rgba(0,0,0,0.35)] bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border-subtle px-3.5 drag-handle min-h-[40px] py-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 shrink-0 rounded-full bg-accent-green/60" />
            <span className="text-body-sm font-medium text-white/60">
              Command History
            </span>
            <span className="font-mono text-caption text-white/30">
              {data.terminalSessionId.slice(0, 8)}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="nodrag nopan p-1.5 rounded-md hover:bg-red-500/20 transition-colors text-white/40 hover:text-red-400"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="nodrag nopan flex border-b border-border-subtle/50">
          <button onClick={() => setActiveTab("history")} className={tabClass(activeTab === "history")}>
            <Clock className="h-3 w-3" />
            History
          </button>
          <button onClick={() => setActiveTab("top")} className={tabClass(activeTab === "top")}>
            <BarChart3 className="h-3 w-3" />
            Top 10
          </button>
        </div>

        <div className="nodrag nopan nowheel flex-1 overflow-auto p-2">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center py-8 text-caption text-white/30">
              Loading...
            </div>
          ) : activeTab === "history" ? (
            <HistoryTab commands={commands} terminalSessionId={data.terminalSessionId} />
          ) : (
            <TopTab commands={topCommands} terminalSessionId={data.terminalSessionId} />
          )}
        </div>
      </div>
    </>
  );
}

export const CommandHistoryNode = memo(CommandHistoryNodeComponent);

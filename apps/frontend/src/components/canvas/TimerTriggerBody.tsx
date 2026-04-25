import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Timer, MoreHorizontal, Trash2, Zap, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { useTriggers, onTriggerFired } from "@/hooks/use-triggers";
import { useTerminalCollaboration } from "@/hooks/use-terminal-collaboration";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TriggerPromptEditor } from "./TriggerPromptEditor";
import type { Trigger, TimerTriggerConfig, TriggerPromptLanguage } from "@excaliterm/shared-types";

const PROMPT_LINE_HEIGHT = 20;
const PROMPT_MIN_LINES = 2;
const PROMPT_MAX_LINES = 4;
const PROMPT_VPAD = 12;

interface Props {
  trigger: Trigger;
  selected: boolean;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TimerTriggerBodyComponent({ trigger, selected }: Props) {
  const config = trigger.config as TimerTriggerConfig;
  const { updateTrigger, deleteTrigger, fireTrigger } = useTriggers();
  const { lockedByOther } = useTerminalCollaboration(trigger.terminalSessionId);

  const [interval, setIntervalLocal] = useState<number>(config.intervalMin);
  const [prompt, setPromptLocal] = useState<string>(config.prompt);
  const [fired, setFired] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIntervalLocal(config.intervalMin);
    setPromptLocal(config.prompt);
  }, [config.intervalMin, config.prompt]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lines = Math.max(
      PROMPT_MIN_LINES,
      Math.min(PROMPT_MAX_LINES, Math.ceil((el.scrollHeight - PROMPT_VPAD) / PROMPT_LINE_HEIGHT)),
    );
    el.style.height = `${lines * PROMPT_LINE_HEIGHT + PROMPT_VPAD}px`;
  }, [prompt]);

  useEffect(() => {
    return onTriggerFired((evt) => {
      if (evt.triggerId !== trigger.id) return;
      setFired(true);
      window.setTimeout(() => setFired(false), 700);
    });
  }, [trigger.id]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!trigger.enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [trigger.enabled]);

  const persistConfig = useCallback(
    async (next: { intervalMin?: number; prompt?: string; language?: TriggerPromptLanguage }) => {
      try {
        await updateTrigger({ id: trigger.id, data: { config: next } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    },
    [trigger.id, updateTrigger],
  );

  const handleEditorSave = useCallback(
    (nextPrompt: string, nextLanguage: TriggerPromptLanguage) => {
      setPromptLocal(nextPrompt);
      void persistConfig({ prompt: nextPrompt, language: nextLanguage });
    },
    [persistConfig],
  );

  const toggleEnabled = useCallback(async () => {
    if (!trigger.enabled && !prompt.trim()) {
      toast.error("Add a prompt first");
      return;
    }
    try {
      await updateTrigger({ id: trigger.id, data: { enabled: !trigger.enabled } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }, [trigger.enabled, trigger.id, prompt, updateTrigger]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteTrigger(trigger.id);
    } catch {
      toast.error("Failed to delete trigger");
    }
  }, [trigger.id, deleteTrigger]);

  const handleFireNow = useCallback(() => {
    if (!prompt.trim()) {
      toast.error("Add a prompt first");
      return;
    }
    fireTrigger(trigger.id);
  }, [trigger.id, prompt, fireTrigger]);

  const enabled = trigger.enabled;
  const readOnly = lockedByOther;
  const lastFiredMs = trigger.lastFiredAt ? new Date(trigger.lastFiredAt).getTime() : null;
  const intervalMs = config.intervalMin * 60_000;
  const nextAt = lastFiredMs ? lastFiredMs + intervalMs : null;
  const remaining = enabled && nextAt ? nextAt - now : null;
  const dotClass = enabled
    ? "bg-accent-amber shadow-[0_0_8px_rgba(251,191,36,0.6)]"
    : "bg-white/30";

  return (
    <div className="h-full w-full">
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-amber-400/40 !border-0 !rounded-sm" />
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-xl border border-amber-400/20 bg-card transition-all ${
          enabled ? "trigger-active" : ""
        } ${fired ? "trigger-fired" : ""} ${selected ? "ring-1 ring-amber-400/40" : ""}`}
      >
        <div className="drag-handle flex items-center justify-between border-b border-amber-400/15 px-3 min-h-[36px] py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <Timer className="h-3.5 w-3.5 text-accent-amber/80" />
            <span className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-accent-amber/90">
              Timer
            </span>
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="nodrag nopan flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleFireNow} disabled={readOnly}>
                <Zap className="h-3.5 w-3.5" />
                <span>Fire now</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={readOnly}
                className="text-accent-red focus:text-accent-red"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete trigger</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="nodrag nopan flex flex-1 flex-col gap-2.5 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-caption uppercase tracking-wide text-white/40">every</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const v = Math.max(1, interval - 1);
                  setIntervalLocal(v);
                  void persistConfig({ intervalMin: v });
                }}
                disabled={readOnly}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] disabled:opacity-30"
              >
                −
              </button>
              <input
                type="number"
                name="trigger-interval-min"
                aria-label="Trigger interval in minutes"
                min={1}
                max={1440}
                value={interval}
                onChange={(e) => setIntervalLocal(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))}
                onBlur={() => persistConfig({ intervalMin: interval })}
                disabled={readOnly}
                className="w-12 rounded-md bg-transparent text-center font-mono text-h3 font-semibold text-foreground outline-none focus:bg-white/[0.04]"
              />
              <button
                onClick={() => {
                  const v = Math.min(1440, interval + 1);
                  setIntervalLocal(v);
                  void persistConfig({ intervalMin: v });
                }}
                disabled={readOnly}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] disabled:opacity-30"
              >
                +
              </button>
              <span className="text-caption text-white/40">min</span>
            </div>
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              name="trigger-prompt"
              aria-label="Trigger prompt"
              value={prompt}
              onChange={(e) => setPromptLocal(e.target.value)}
              onBlur={() => persistConfig({ prompt })}
              disabled={readOnly}
              placeholder="command to run…"
              spellCheck={false}
              rows={PROMPT_MIN_LINES}
              style={{ lineHeight: `${PROMPT_LINE_HEIGHT}px` }}
              className="block w-full resize-none rounded-md border border-white/10 bg-surface-sunken px-2.5 py-1.5 pr-7 font-mono text-body-sm text-foreground/90 placeholder:text-white/25 outline-none focus:border-amber-400/40"
            />
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              title="Open in editor"
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/85"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <button
              onClick={toggleEnabled}
              disabled={readOnly}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-caption font-semibold transition-colors ${
                enabled
                  ? "border-amber-400/30 bg-amber-400/15 text-accent-amber hover:bg-amber-400/20"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.08]"
              } disabled:opacity-50`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-accent-amber" : "bg-white/40"}`} />
              {enabled ? "active" : "paused"}
            </button>
            <span className="font-mono text-caption text-white/40">
              {enabled && remaining !== null ? `next ${formatCountdown(remaining)}` : "—"}
            </span>
          </div>

          {trigger.lastError && (
            <div className="rounded-md border border-accent-red/30 bg-accent-red/10 px-2 py-1 text-caption text-accent-red/90">
              {trigger.lastError}
            </div>
          )}
        </div>
      </div>

      <TriggerPromptEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialPrompt={prompt}
        initialLanguage={config.language ?? "shell"}
        onSave={handleEditorSave}
        readOnly={readOnly}
      />
    </div>
  );
}

export const TimerTriggerBody = memo(TimerTriggerBodyComponent);

import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { useTriggers } from "@/hooks/use-triggers";
import type { TriggerNodeData } from "@/hooks/use-canvas";
import { TimerTriggerBody } from "./TimerTriggerBody";
import { HttpTriggerBody } from "./HttpTriggerBody";
import { useNodeSpawnClass } from "./setup-agent/useNodeSpawnClass";

type TriggerNodeType = Node<TriggerNodeData>;

function TriggerNodeComponent({ id, data, selected }: NodeProps<TriggerNodeType>) {
  const { triggers } = useTriggers();
  const trigger = triggers.find((t) => t.id === data.triggerId);
  const spawnClass = useNodeSpawnClass(id);

  if (!trigger) {
    return (
      <div className={`flex h-full w-full items-center justify-center rounded-xl border border-border-subtle bg-card text-caption text-muted-foreground ${spawnClass}`}>
        Loading trigger…
      </div>
    );
  }

  const body =
    trigger.type === "http" ? (
      <HttpTriggerBody trigger={trigger} selected={!!selected} />
    ) : (
      <TimerTriggerBody trigger={trigger} selected={!!selected} />
    );

  if (!spawnClass) return body;
  return <div className={`h-full w-full ${spawnClass}`}>{body}</div>;
}

export const TriggerNode = memo(TriggerNodeComponent);

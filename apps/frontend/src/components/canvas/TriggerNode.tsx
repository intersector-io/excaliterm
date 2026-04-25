import { memo } from "react";
import { type NodeProps, type Node } from "@xyflow/react";
import { useTriggers } from "@/hooks/use-triggers";
import type { TriggerNodeData } from "@/hooks/use-canvas";
import { TimerTriggerBody } from "./TimerTriggerBody";
import { HttpTriggerBody } from "./HttpTriggerBody";

type TriggerNodeType = Node<TriggerNodeData>;

function TriggerNodeComponent({ data, selected }: NodeProps<TriggerNodeType>) {
  const { triggers } = useTriggers();
  const trigger = triggers.find((t) => t.id === data.triggerId);

  if (!trigger) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-border-subtle bg-card text-caption text-muted-foreground">
        Loading trigger…
      </div>
    );
  }

  if (trigger.type === "http") {
    return <HttpTriggerBody trigger={trigger} selected={!!selected} />;
  }
  return <TimerTriggerBody trigger={trigger} selected={!!selected} />;
}

export const TriggerNode = memo(TriggerNodeComponent);

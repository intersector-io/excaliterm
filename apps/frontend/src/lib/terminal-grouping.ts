import { getTagColor } from "@/components/canvas/TagEditor";
import type { TerminalSession } from "@excaliterm/shared-types";

export type GroupMode = "status" | "tag" | "host";

export interface TerminalGroup {
  key: string;
  label: string;
  colorClasses?: string;
  terminals: TerminalSession[];
}

export function groupTerminals(
  terminals: TerminalSession[],
  mode: GroupMode,
  services: { id: string; name: string }[],
): TerminalGroup[] {
  if (mode === "status") {
    const active = terminals.filter((t) => t.status === "active");
    const inactive = terminals.filter((t) => t.status !== "active");
    const groups: TerminalGroup[] = [];
    if (active.length > 0) {
      groups.push({ key: "active", label: `Active (${active.length})`, terminals: active });
    }
    if (inactive.length > 0) {
      groups.push({ key: "inactive", label: `Inactive (${inactive.length})`, terminals: inactive });
    }
    return groups;
  }

  if (mode === "tag") {
    const tagMap = new Map<string, TerminalSession[]>();
    const untagged: TerminalSession[] = [];

    for (const t of terminals) {
      const tags = t.tags ?? [];
      if (tags.length === 0) {
        untagged.push(t);
      } else {
        for (const tag of tags) {
          const list = tagMap.get(tag) ?? [];
          list.push(t);
          tagMap.set(tag, list);
        }
      }
    }

    const groups: TerminalGroup[] = Array.from(tagMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, terms]) => ({
        key: `tag-${tag}`,
        label: tag,
        colorClasses: getTagColor(tag),
        terminals: terms,
      }));

    if (untagged.length > 0) {
      groups.push({ key: "__untagged", label: "untagged", terminals: untagged });
    }
    return groups;
  }

  // host mode
  const hostMap = new Map<string, TerminalSession[]>();
  const orphaned: TerminalSession[] = [];

  for (const t of terminals) {
    if (t.serviceInstanceId) {
      const list = hostMap.get(t.serviceInstanceId) ?? [];
      list.push(t);
      hostMap.set(t.serviceInstanceId, list);
    } else {
      orphaned.push(t);
    }
  }

  const groups: TerminalGroup[] = Array.from(hostMap.entries()).map(
    ([id, terms]) => {
      const svc = services.find((s) => s.id === id);
      return {
        key: `host-${id}`,
        label: svc?.name ?? id.slice(0, 8),
        terminals: terms,
      };
    },
  );

  if (orphaned.length > 0) {
    groups.push({ key: "__nohost", label: "no host", terminals: orphaned });
  }
  return groups;
}

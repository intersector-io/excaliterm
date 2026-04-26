import { Server } from "lucide-react";
import { useServices } from "@/hooks/use-services";
import { useSetupAgentStore } from "@/stores/setup-agent-store";
import { formatRelativeTime } from "@/lib/format-time";

export function StepHost() {
  const { services, isLoading } = useServices();
  const hostId = useSetupAgentStore((s) => s.hostId);
  const setHostId = useSetupAgentStore((s) => s.setHostId);

  const onlineServices = services.filter((s) => s.status === "online");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-h1 font-semibold tracking-tight">Where does the agent live?</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Both terminals — the coding agent and the sidecar shell — must run on the same host so they share a filesystem.
        </p>
      </div>

      {isLoading && (
        <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-body-sm text-muted-foreground">
          Loading hosts…
        </div>
      )}

      {!isLoading && onlineServices.length === 0 && (
        <div className="rounded-md border border-dashed border-accent-amber/30 bg-accent-amber/[0.04] px-4 py-6">
          <p className="text-body-sm text-foreground/80">No hosts online.</p>
          <p className="mt-1 text-caption text-muted-foreground">
            Install <span className="font-mono">excaliterm</span> on a machine and connect it to this workspace, then come back.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {services.map((service) => {
          const isOnline = service.status === "online";
          const isSelected = service.id === hostId;
          return (
            <label
              key={service.id}
              className={`flex items-center gap-3 rounded-md border px-3 py-2.5 transition-all ${
                isSelected
                  ? "border-accent-amber/60 bg-accent-amber/[0.06] ring-1 ring-accent-amber/20"
                  : "border-border-subtle/60 bg-card hover:border-border-default"
              } ${isOnline ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
            >
              <input
                type="radio"
                name="host"
                value={service.id}
                checked={isSelected}
                disabled={!isOnline}
                onChange={() => setHostId(service.id)}
                className="h-3.5 w-3.5 cursor-pointer accent-amber-400"
              />
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-sunken">
                <Server className={`h-4 w-4 ${isOnline ? "text-accent-green/70" : "text-muted-foreground/40"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-body-sm font-medium text-foreground">
                    {service.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        isOnline ? "bg-accent-green animate-pulse" : "bg-muted-foreground/30"
                      }`}
                    />
                    <span className="font-mono text-caption uppercase tracking-[0.18em] text-muted-foreground">
                      {isOnline ? "online" : "offline"}
                    </span>
                  </div>
                </div>
                <span className="mt-0.5 block truncate font-mono text-caption text-muted-foreground/40">
                  {service.serviceId.slice(0, 12)} · {isOnline ? "ready" : formatRelativeTime(service.lastSeen)}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

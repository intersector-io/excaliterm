import { useEffect, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api-client";
import { getTerminalHub } from "@/lib/signalr-client";
import { useWorkspace } from "@/hooks/use-workspace";

export function useServices() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const servicesQuery = useQuery({
    queryKey: ["services", workspaceId],
    queryFn: () => api.listServices(workspaceId),
  });

  useEffect(() => {
    const terminalHub = getTerminalHub();

    function handleServiceOnline(serviceId: string) {
      const old = queryClient.getQueryData<{ services: api.ServiceInstance[] }>(["services", workspaceId]);
      const exists = old?.services.some((s) => s.serviceId === serviceId);

      if (exists) {
        queryClient.setQueryData(
          ["services", workspaceId],
          (prev: { services: api.ServiceInstance[] } | undefined) => {
            if (!prev) return prev;
            return {
              services: prev.services.map((s) =>
                s.serviceId === serviceId ? { ...s, status: "online" as const } : s,
              ),
            };
          },
        );
      } else {
        // New service auto-registered by CLI — refetch list
        queryClient.invalidateQueries({ queryKey: ["services", workspaceId] });
      }
    }

    function handleServiceOffline(serviceId: string) {
      queryClient.setQueryData(
        ["services", workspaceId],
        (old: { services: api.ServiceInstance[] } | undefined) => {
          if (!old) return old;
          return {
            services: old.services.map((s) =>
              s.serviceId === serviceId
                ? { ...s, status: "offline" as const, lastSeen: new Date().toISOString() }
                : s,
            ),
          };
        },
      );
    }

    terminalHub.on("ServiceOnline", handleServiceOnline);
    terminalHub.on("ServiceOffline", handleServiceOffline);

    return () => {
      terminalHub.off("ServiceOnline", handleServiceOnline);
      terminalHub.off("ServiceOffline", handleServiceOffline);
    };
  }, [queryClient, workspaceId]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteServiceApi(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", workspaceId] });
    },
  });

  const [isShuttingDown, setIsShuttingDown] = useState(false);

  const shutdownService = useCallback(async (serviceId: string) => {
    const terminalHub = getTerminalHub();
    setIsShuttingDown(true);
    try {
      await terminalHub.invoke("ShutdownService", serviceId);
    } finally {
      setIsShuttingDown(false);
    }
  }, []);

  const services = servicesQuery.data?.services ?? [];
  const onlineCount = services.filter((s) => s.status === "online").length;

  return {
    services,
    onlineCount,
    isLoading: servicesQuery.isLoading,
    deleteService: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    shutdownService,
    isShuttingDown,
  };
}

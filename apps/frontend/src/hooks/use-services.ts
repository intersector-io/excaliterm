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
      queryClient.setQueryData(
        ["services", workspaceId],
        (old: { services: api.ServiceInstance[] } | undefined) => {
          if (!old) return old;
          return {
            services: old.services.map((s) =>
              s.serviceId === serviceId ? { ...s, status: "online" as const } : s,
            ),
          };
        },
      );
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

  const registerMutation = useMutation({
    mutationFn: (name: string) => api.createService(workspaceId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", workspaceId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; whitelistedPaths?: string };
    }) => api.updateService(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services", workspaceId] });
    },
  });

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
    registerService: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    updateService: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteService: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    shutdownService,
    isShuttingDown,
  };
}

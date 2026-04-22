import { useState, useCallback, useEffect, useRef } from "react";
import { getFileHub } from "@/lib/signalr-client";
import { useWorkspace } from "@/hooks/use-workspace";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api-client";
import type { MonitorInfo, ScreenshotCapturedEvent } from "@excaliterm/shared-types";

export function useScreenshot() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [isLoadingMonitors, setIsLoadingMonitors] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const pendingScreenshot = useRef<{
    serviceId: string;
    serviceInstanceId: string;
    monitorIndex: number;
    sourceTerminalNodeId: string;
    resolve: (value: void) => void;
    reject: (err: Error) => void;
  } | null>(null);

  useEffect(() => {
    const fileHub = getFileHub();

    function handleMonitorListing(event: { serviceId: string; monitors: MonitorInfo[] }) {
      setMonitors(event.monitors);
      setIsLoadingMonitors(false);
    }

    function handleScreenshotCaptured(event: ScreenshotCapturedEvent) {
      const pending = pendingScreenshot.current;
      if (!pending) return;

      pendingScreenshot.current = null;

      api
        .createScreenshot(workspaceId, {
          serviceInstanceId: pending.serviceInstanceId,
          imageData: event.imageBase64,
          monitorIndex: event.monitorIndex,
          width: event.width,
          height: event.height,
          sourceTerminalNodeId: pending.sourceTerminalNodeId,
        })
        .then(() => {
          setIsCapturing(false);
          queryClient.invalidateQueries({ queryKey: ["canvas-nodes", workspaceId] });
          queryClient.invalidateQueries({ queryKey: ["canvas-edges", workspaceId] });
          queryClient.invalidateQueries({ queryKey: ["screenshots", workspaceId] });
          pending.resolve();
        })
        .catch((err) => {
          console.error("[useScreenshot] Failed to save screenshot:", err);
          setIsCapturing(false);
          pending.reject(err instanceof Error ? err : new Error(String(err)));
        });
    }

    fileHub.on("MonitorListing", handleMonitorListing);
    fileHub.on("ScreenshotCaptured", handleScreenshotCaptured);

    return () => {
      fileHub.off("MonitorListing", handleMonitorListing);
      fileHub.off("ScreenshotCaptured", handleScreenshotCaptured);
    };
  }, [workspaceId, queryClient]);

  const listMonitors = useCallback(async (serviceId: string) => {
    setIsLoadingMonitors(true);
    setMonitors([]);
    const fileHub = getFileHub();
    await fileHub.invoke("ListMonitors", serviceId);
  }, []);

  const captureScreenshot = useCallback(
    (serviceId: string, serviceInstanceId: string, monitorIndex: number, sourceTerminalNodeId: string) => {
      return new Promise<void>((resolve, reject) => {
        setIsCapturing(true);
        pendingScreenshot.current = {
          serviceId,
          serviceInstanceId,
          monitorIndex,
          sourceTerminalNodeId,
          resolve,
          reject,
        };

        const fileHub = getFileHub();
        fileHub.invoke("CaptureScreenshot", serviceId, monitorIndex).catch((err) => {
          console.error("[useScreenshot] CaptureScreenshot invoke failed:", err);
          setIsCapturing(false);
          pendingScreenshot.current = null;
          reject(err);
        });
      });
    },
    [],
  );

  return {
    monitors,
    isLoadingMonitors,
    isCapturing,
    listMonitors,
    captureScreenshot,
  };
}

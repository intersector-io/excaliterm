import { useCallback, useEffect, useRef } from "react";
import { getFileHub } from "@/lib/signalr-client";
import { useScreenShareStore } from "@/stores/screen-share-store";
import type { WebRtcOfferEvent, ScreenshotCapturedEvent } from "@excaliterm/shared-types";

export function useScreenShare() {
  const store = useScreenShareStore();
  const pendingStart = useRef<{
    serviceId: string;
    monitorIndex: number;
    resolve: (session: { sessionId: string; serviceId: string; monitorIndex: number }) => void;
    reject: (err: Error) => void;
  } | null>(null);

  useEffect(() => {
    const fileHub = getFileHub();

    function handleSessionCreated(event: WebRtcOfferEvent) {
      if (event.type !== "session-created") return;

      const pending = pendingStart.current;
      if (!pending) return;
      pendingStart.current = null;

      useScreenShareStore.getState().addSession(event.sessionId, event.serviceId, pending.monitorIndex);

      pending.resolve({
        sessionId: event.sessionId,
        serviceId: event.serviceId,
        monitorIndex: pending.monitorIndex,
      });
    }

    function handleFrame(event: ScreenshotCapturedEvent & { sessionId?: string }) {
      const sessionId = event.sessionId ?? "";
      if (!sessionId) return;
      useScreenShareStore.getState().updateFrame(sessionId, {
        imageBase64: event.imageBase64,
        width: event.width,
        height: event.height,
      });
    }

    fileHub.on("ScreenShareOffer", handleSessionCreated);
    fileHub.on("ScreenShareFrame", handleFrame);

    return () => {
      fileHub.off("ScreenShareOffer", handleSessionCreated);
      fileHub.off("ScreenShareFrame", handleFrame);
    };
  }, []);

  const startScreenShare = useCallback(
    (serviceId: string, monitorIndex: number): Promise<{ sessionId: string; serviceId: string; monitorIndex: number }> => {
      return new Promise((resolve, reject) => {
        pendingStart.current = { serviceId, monitorIndex, resolve, reject };

        const fileHub = getFileHub();
        fileHub.invoke("StartScreenShare", serviceId, monitorIndex).catch((err) => {
          pendingStart.current = null;
          reject(err);
        });
      });
    },
    [],
  );

  const stopScreenShare = useCallback(
    (serviceId: string, sessionId: string) => {
      useScreenShareStore.getState().removeSession(sessionId);

      const fileHub = getFileHub();
      fileHub.invoke("StopScreenShare", serviceId, sessionId).catch(() => {});
    },
    [],
  );

  return {
    sessions: store.sessions,
    startScreenShare,
    stopScreenShare,
  };
}

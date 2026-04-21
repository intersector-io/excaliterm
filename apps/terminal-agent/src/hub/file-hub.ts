import * as signalR from "@microsoft/signalr";
import type { Config } from "../config.js";
import type { FileSystemHandler } from "../filesystem/handler.js";
import type { ScreenshotHandler } from "../screenshot/handler.js";
import type { ScreenShareManager } from "../screen-share/manager.js";

interface DirectoryListingResponse {
  serviceId: string;
  path: string;
    entries: {
      name: string;
      path: string;
      isDirectory: boolean;
      size: number | null;
      modifiedAt: string | null;
    }[];
}

interface FileContentResponse {
  serviceId: string;
  path: string;
  content: string;
}

interface FileErrorResponse {
  serviceId: string;
  path: string;
  error: string;
}

export class FileHubConnection {
  private hub: signalR.HubConnection;
  private readonly config: Config;
  private readonly fileHandler: FileSystemHandler;
  private readonly screenshotHandler: ScreenshotHandler;
  private readonly screenShareManager: ScreenShareManager;

  constructor(config: Config, fileHandler: FileSystemHandler, screenshotHandler: ScreenshotHandler, screenShareManager: ScreenShareManager) {
    this.config = config;
    this.fileHandler = fileHandler;
    this.screenshotHandler = screenshotHandler;
    this.screenShareManager = screenShareManager;

    const url = `${config.signalrHubUrl.replace(/\/+$/, "")}/hubs/file?apiKey=${encodeURIComponent(config.serviceApiKey)}&workspaceId=${encodeURIComponent(config.workspaceId)}`;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect()
      .build();

    this.registerLifecycleHandlers();
    this.registerCommandHandlers();
  }

  async start(): Promise<void> {
    console.log(
      `[FileHub] Connecting to File Hub at ${this.config.signalrHubUrl}`
    );
    await this.hub.start();
    console.log("[FileHub] Connected to File Hub");

    await this.hub.invoke(
      "RegisterService",
      this.config.serviceId,
      this.config.serviceApiKey
    );
    console.log(
      `[FileHub] Registered as service ${this.config.serviceId}`
    );
  }

  async stop(): Promise<void> {
    await this.hub.stop();
    console.log("[FileHub] Disconnected from File Hub");
  }

  // ── Incoming command handlers (Hub -> Agent) ─────────────────────────────

  private registerCommandHandlers(): void {
    this.hub.on(
      "ListDirectory",
      async (callerConnectionId: string, serviceId: string, dirPath: string) => {
        console.log(
          `[FileHub] Received ListDirectory: ${dirPath} from ${callerConnectionId}`
        );
        try {
          const entries = await this.fileHandler.listDirectory(dirPath);
          const response: DirectoryListingResponse = {
            serviceId,
            path: dirPath,
            entries,
          };
          await this.hub.invoke(
            "DirectoryListingResponse",
            callerConnectionId,
            response
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[FileHub] Failed to list directory ${dirPath}: ${message}`);
          const error: FileErrorResponse = {
            serviceId,
            path: dirPath,
            error: message,
          };
          await this.hub.invoke(
            "FileErrorResponse",
            callerConnectionId,
            error
          );
        }
      }
    );

    this.hub.on(
      "ReadFile",
      async (callerConnectionId: string, serviceId: string, filePath: string) => {
        console.log(
          `[FileHub] Received ReadFile: ${filePath} from ${callerConnectionId}`
        );
        try {
          const { content } = await this.fileHandler.readFile(filePath);
          const response: FileContentResponse = {
            serviceId,
            path: filePath,
            content,
          };
          await this.hub.invoke(
            "FileContentResponse",
            callerConnectionId,
            response
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[FileHub] Failed to read file ${filePath}: ${message}`);
          const error: FileErrorResponse = {
            serviceId,
            path: filePath,
            error: message,
          };
          await this.hub.invoke(
            "FileErrorResponse",
            callerConnectionId,
            error
          );
        }
      }
    );

    this.hub.on(
      "WriteFile",
      async (
        callerConnectionId: string,
        serviceId: string,
        filePath: string,
        content: string
      ) => {
        console.log(
          `[FileHub] Received WriteFile: ${filePath} from ${callerConnectionId}`
        );
        try {
          await this.fileHandler.writeFile(filePath, content);
          const response: FileContentResponse = {
            serviceId,
            path: filePath,
            content,
          };
          await this.hub.invoke(
            "FileContentResponse",
            callerConnectionId,
            response
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[FileHub] Failed to write file ${filePath}: ${message}`);
          const error: FileErrorResponse = {
            serviceId,
            path: filePath,
            error: message,
          };
          await this.hub.invoke(
            "FileErrorResponse",
            callerConnectionId,
            error
          );
        }
      }
    );

    // ── Monitor / Screenshot handlers ───────────────────────────────────────

    this.hub.on(
      "ListMonitors",
      async (callerConnectionId: string, serviceId: string) => {
        console.log(`[FileHub] Received ListMonitors from ${callerConnectionId}`);
        try {
          const monitors = await this.screenshotHandler.listMonitors();
          await this.hub.invoke("MonitorListResponse", callerConnectionId, {
            serviceId,
            monitors,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[FileHub] Failed to list monitors: ${message}`);
          await this.hub.invoke("FileErrorResponse", callerConnectionId, {
            serviceId,
            path: "",
            error: message,
          });
        }
      }
    );

    this.hub.on(
      "CaptureScreenshot",
      async (callerConnectionId: string, serviceId: string, monitorIndex: number) => {
        console.log(`[FileHub] Received CaptureScreenshot: monitor ${monitorIndex} from ${callerConnectionId}`);
        try {
          const result = await this.screenshotHandler.captureMonitor(monitorIndex);
          await this.hub.invoke("ScreenshotResponse", callerConnectionId, {
            serviceId,
            imageBase64: result.imageBase64,
            monitorIndex,
            width: result.width,
            height: result.height,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[FileHub] Failed to capture screenshot: ${message}`);
          await this.hub.invoke("FileErrorResponse", callerConnectionId, {
            serviceId,
            path: "",
            error: message,
          });
        }
      }
    );

    // ── Screen Share handlers (frame-based streaming over SignalR) ─────────

    this.hub.on(
      "StartScreenShare",
      async (callerConnectionId: string, serviceId: string, monitorIndex: number) => {
        console.log(`[FileHub] Received StartScreenShare: monitor ${monitorIndex} from ${callerConnectionId}`);
        try {
          const sessionId = `${serviceId}-${Date.now()}`;

          let consecutiveFailures = 0;
          const MAX_FAILURES = 5;

          this.screenShareManager.startSession(
            sessionId,
            monitorIndex,
            // onFrame callback — send each frame to the browser
            (imageBase64: string, width: number, height: number) => {
              this.hub.invoke("ScreenShareFrameResponse", callerConnectionId, {
                serviceId,
                sessionId,
                imageBase64,
                width,
                height,
              }).then(() => {
                consecutiveFailures = 0;
              }).catch(() => {
                consecutiveFailures++;
                if (consecutiveFailures >= MAX_FAILURES) {
                  console.log(`[FileHub] Stream ${sessionId}: ${MAX_FAILURES} consecutive failures, stopping`);
                  this.screenShareManager.stopSession(sessionId);
                }
              });
            },
            3, // ~3 fps
          );

          // Notify browser that streaming session started
          await this.hub.invoke("ScreenShareOfferResponse", callerConnectionId, {
            serviceId,
            sessionId,
            sdp: "",
            type: "session-created",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[FileHub] Failed to start screen share: ${message}`);
          await this.hub.invoke("FileErrorResponse", callerConnectionId, {
            serviceId,
            path: "",
            error: `Screen share failed: ${message}`,
          });
        }
      }
    );

    this.hub.on(
      "StopScreenShare",
      (_callerConnectionId: string, _serviceId: string, sessionId: string) => {
        console.log(`[FileHub] Received StopScreenShare: session ${sessionId}`);
        this.screenShareManager.stopSession(sessionId);
      }
    );
  }

  // ── Lifecycle handlers ───────────────────────────────────────────────────

  private registerLifecycleHandlers(): void {
    this.hub.onreconnecting((error) => {
      console.warn(
        "[FileHub] Connection lost, reconnecting...",
        error?.message
      );
    });

    this.hub.onreconnected(async (connectionId) => {
      console.log(`[FileHub] Reconnected with connection ${connectionId}`);
      try {
        await this.hub.invoke(
          "RegisterService",
          this.config.serviceId,
          this.config.serviceApiKey
        );
        console.log(
          `[FileHub] Re-registered as service ${this.config.serviceId} after reconnection`
        );
      } catch (err) {
        console.error("[FileHub] Failed to re-register after reconnection:", err);
      }
    });

    this.hub.onclose((error) => {
      if (error) {
        console.error("[FileHub] Connection closed with error:", error.message);
      } else {
        console.log("[FileHub] Connection closed");
      }
    });
  }
}

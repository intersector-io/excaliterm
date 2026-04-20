import * as signalR from "@microsoft/signalr";
import type { Config } from "../config.js";
import type { FileSystemHandler } from "../filesystem/handler.js";

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

  constructor(config: Config, fileHandler: FileSystemHandler) {
    this.config = config;
    this.fileHandler = fileHandler;

    const url = `${config.signalrHubUrl.replace(/\/+$/, "")}/hubs/file?apiKey=${encodeURIComponent(config.serviceApiKey)}&tenantId=${encodeURIComponent(config.tenantId)}`;

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

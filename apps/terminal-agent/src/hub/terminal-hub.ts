import * as signalR from "@microsoft/signalr";
import type { Config } from "../config.js";
import type { TerminalManager } from "../terminal/manager.js";

export class TerminalHubConnection {
  private hub: signalR.HubConnection;
  private readonly config: Config;
  private readonly manager: TerminalManager;

  constructor(config: Config, manager: TerminalManager) {
    this.config = config;
    this.manager = manager;

    const url = `${config.signalrHubUrl.replace(/\/+$/, "")}/hubs/terminal?apiKey=${encodeURIComponent(config.serviceApiKey)}&workspaceId=${encodeURIComponent(config.workspaceId)}`;

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(url)
      .withAutomaticReconnect()
      .build();

    this.registerLifecycleHandlers();
    this.registerCommandHandlers();
    this.wireManagerEvents();
  }

  async start(): Promise<void> {
    console.log(
      `[TerminalHub] Connecting to Terminal Hub at ${this.config.signalrHubUrl}`
    );
    await this.hub.start();
    console.log("[TerminalHub] Connected to Terminal Hub");

    await this.hub.invoke(
      "RegisterService",
      this.config.serviceId,
      this.config.serviceApiKey
    );
    console.log(
      `[TerminalHub] Registered as service ${this.config.serviceId} for workspace ${this.config.workspaceId}`
    );
  }

  async stop(): Promise<void> {
    this.manager.destroyAll();
    await this.hub.stop();
    console.log("[TerminalHub] Disconnected from Terminal Hub");
  }

  // ── Incoming command handlers (Hub -> Agent) ─────────────────────────────

  private registerCommandHandlers(): void {
    this.hub.on(
      "CreateTerminal",
      async (terminalId: string, cols: number, rows: number) => {
        console.log(
          `[TerminalHub] Received CreateTerminal: ${terminalId} (${cols}x${rows})`
        );
        try {
          this.manager.createTerminal(terminalId, cols, rows);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            `[TerminalHub] Failed to create terminal ${terminalId}: ${message}`
          );
          await this.sendTerminalError(terminalId, message);
        }
      }
    );

    this.hub.on("DestroyTerminal", (terminalId: string) => {
      console.log(`[TerminalHub] Received DestroyTerminal: ${terminalId}`);
      this.manager.destroyTerminal(terminalId);
    });

    this.hub.on("TerminalInput", (terminalId: string, data: string) => {
      // data is plain UTF-8 text from the hub
      this.manager.writeToTerminal(terminalId, data);
    });

    this.hub.on(
      "TerminalResize",
      (terminalId: string, cols: number, rows: number) => {
        this.manager.resizeTerminal(terminalId, cols, rows);
      }
    );
  }

  // ── Outgoing events (Agent -> Hub) ───────────────────────────────────────

  private wireManagerEvents(): void {
    this.manager.onCreated = (id: string) => {
      this.sendTerminalCreated(id).catch((err) =>
        console.error(`[TerminalHub] Error sending TerminalCreated:`, err)
      );
    };

    this.manager.onOutput = (id: string, data: string) => {
      // node-pty onData already returns UTF-8 strings, send directly
      this.sendTerminalOutput(id, data).catch((err) =>
        console.error(`[TerminalHub] Error sending TerminalOutput:`, err)
      );
    };

    this.manager.onExited = (id: string, exitCode: number) => {
      this.sendTerminalExited(id, exitCode).catch((err) =>
        console.error(`[TerminalHub] Error sending TerminalExited:`, err)
      );
    };

    this.manager.onError = (id: string, error: string) => {
      this.sendTerminalError(id, error).catch((err) =>
        console.error(`[TerminalHub] Error sending TerminalError:`, err)
      );
    };
  }

  private async sendTerminalCreated(terminalId: string): Promise<void> {
    if (this.hub.state !== signalR.HubConnectionState.Connected) {
      console.warn("[TerminalHub] Cannot send TerminalCreated, hub is not connected");
      return;
    }
    await this.hub.invoke("TerminalCreated", terminalId);
  }

  private async sendTerminalOutput(
    terminalId: string,
    data: string
  ): Promise<void> {
    if (this.hub.state !== signalR.HubConnectionState.Connected) return;
    await this.hub.invoke("TerminalOutput", terminalId, data);
  }

  private async sendTerminalExited(
    terminalId: string,
    exitCode: number
  ): Promise<void> {
    if (this.hub.state !== signalR.HubConnectionState.Connected) {
      console.warn("[TerminalHub] Cannot send TerminalExited, hub is not connected");
      return;
    }
    await this.hub.invoke("TerminalExited", terminalId, exitCode);
  }

  private async sendTerminalError(
    terminalId: string,
    error: string
  ): Promise<void> {
    if (this.hub.state !== signalR.HubConnectionState.Connected) {
      console.warn("[TerminalHub] Cannot send TerminalError, hub is not connected");
      return;
    }
    await this.hub.invoke("TerminalError", terminalId, error);
  }

  // ── Lifecycle handlers ───────────────────────────────────────────────────

  private registerLifecycleHandlers(): void {
    this.hub.onreconnecting((error) => {
      console.warn(
        "[TerminalHub] Connection lost, reconnecting...",
        error?.message
      );
    });

    this.hub.onreconnected(async (connectionId) => {
      console.log(
        `[TerminalHub] Reconnected with connection ${connectionId}`
      );
      try {
        await this.hub.invoke(
          "RegisterService",
          this.config.serviceId,
          this.config.serviceApiKey
        );
        console.log(
          `[TerminalHub] Re-registered as service ${this.config.serviceId} after reconnection`
        );
      } catch (err) {
        console.error("[TerminalHub] Failed to re-register after reconnection:", err);
      }
    });

    this.hub.onclose((error) => {
      if (error) {
        console.error("[TerminalHub] Connection closed with error:", error.message);
      } else {
        console.log("[TerminalHub] Connection closed");
      }
    });
  }
}

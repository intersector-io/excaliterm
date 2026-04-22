#!/usr/bin/env node
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";

// Load .env from agent dir first, then fall back to monorepo root
dotenvConfig();
dotenvConfig({ path: resolve(import.meta.dirname, "../../../.env") });

import { loadConfig } from "./config.js";
import { TerminalManager } from "./terminal/manager.js";
import { FileSystemHandler } from "./filesystem/handler.js";
import { PathValidator } from "./filesystem/validator.js";
import { TerminalHubConnection } from "./hub/terminal-hub.js";
import { FileHubConnection } from "./hub/file-hub.js";
import { ScreenshotHandler } from "./screenshot/handler.js";
import { ScreenShareManager } from "./screen-share/manager.js";

async function main(): Promise<void> {
  console.log("[terminal-agent] Starting...");

  const config = loadConfig();
  console.log(`[terminal-agent] Service ID: ${config.serviceId}`);
  console.log(`[terminal-agent] Workspace ID: ${config.workspaceId}`);
  console.log(`[terminal-agent] Hub URL: ${config.signalrHubUrl}`);
  console.log(`[terminal-agent] Shell: ${[config.shell, ...config.shellArgs].join(" ")}`);
  console.log(
    `[terminal-agent] Whitelisted paths: ${config.whitelistedPaths.length > 0 ? config.whitelistedPaths.join(", ") : "(none - all paths allowed)"}`,
  );

  const manager = new TerminalManager(config.shell, config.shellArgs);
  const pathValidator = new PathValidator(config.whitelistedPaths);
  const fileHandler = new FileSystemHandler(pathValidator);
  const screenshotHandler = new ScreenshotHandler();
  const screenShareManager = new ScreenShareManager(screenshotHandler);

  const terminalHub = new TerminalHubConnection(config, manager);
  const fileHub = new FileHubConnection(config, fileHandler, screenshotHandler, screenShareManager);

  const shutdown = async (signal: string) => {
    console.log(`\n[terminal-agent] Received ${signal}, shutting down...`);

    manager.destroyAll();
    screenShareManager.stopAll();

    try {
      await Promise.allSettled([terminalHub.stop(), fileHub.stop()]);
    } catch (err) {
      console.error("[terminal-agent] Error during shutdown:", err);
    }

    console.log("[terminal-agent] Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await terminalHub.start();
    await fileHub.start();
  } catch (err) {
    console.error("[terminal-agent] Failed to connect to hub:", err);
    process.exit(1);
  }

  console.log("[terminal-agent] Ready and waiting for commands");
}

main().catch((err) => {
  console.error("[terminal-agent] Fatal error:", err);
  process.exit(1);
});

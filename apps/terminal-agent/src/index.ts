#!/usr/bin/env node
import { resolve } from "node:path";

// process.loadEnvFile is a Node 20.12+ built-in; missing files are intentionally ignored
tryLoadEnvFile(resolve(import.meta.dirname, "../../../.env"));
tryLoadEnvFile();

function tryLoadEnvFile(path?: string): void {
  try {
    path ? process.loadEnvFile(path) : process.loadEnvFile();
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

import { loadConfig } from "./config.js";
import { TerminalManager } from "./terminal/manager.js";
import { probeShell } from "./terminal/process.js";
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
    `[terminal-agent] Whitelisted paths: ${config.whitelistedPaths.length > 0 ? config.whitelistedPaths.join(", ") : "(none - filesystem access disabled)"}`,
  );

  try {
    const probe = probeShell(config.shell, config.shellArgs);
    console.log(`[terminal-agent] Shell self-test passed (shell=${probe.shell}, cwd=${probe.cwd})`);
  } catch (err) {
    console.error(`[terminal-agent] ${err instanceof Error ? err.message : String(err)}`);
    console.error("[terminal-agent] Refusing to start. Fix the shell/cwd above or pass --shell <path>.");
    process.exit(1);
  }

  const manager = new TerminalManager(config.shell, config.shellArgs);
  const pathValidator = new PathValidator(config.whitelistedPaths);
  const fileHandler = new FileSystemHandler(pathValidator);
  const screenshotHandler = new ScreenshotHandler();
  const screenShareManager = new ScreenShareManager(screenshotHandler);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[terminal-agent] Received ${signal}, shutting down...`);

    // Suppress any in-flight reconnect → re-register race before stopping.
    terminalHub.markShuttingDown();
    fileHub.markShuttingDown();

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

  const terminalHub = new TerminalHubConnection(config, manager, () => {
    void shutdown("AgentShutdown");
  });
  const fileHub = new FileHubConnection(config, fileHandler, screenshotHandler, screenShareManager);

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

try {
  await main();
} catch (err) {
  console.error("[terminal-agent] Fatal error:", err);
  process.exit(1);
}

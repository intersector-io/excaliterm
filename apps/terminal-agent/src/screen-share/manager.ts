import { ScreenShareSession } from "./session.js";
import type { ScreenshotHandler } from "../screenshot/handler.js";

export class ScreenShareManager {
  private sessions = new Map<string, ScreenShareSession>();
  private screenshotHandler: ScreenshotHandler;

  constructor(screenshotHandler: ScreenshotHandler) {
    this.screenshotHandler = screenshotHandler;
  }

  startSession(
    sessionId: string,
    monitorIndex: number,
    onFrame: (imageBase64: string, width: number, height: number) => void,
    fps = 3,
  ): ScreenShareSession {
    this.stopSession(sessionId);

    const session = new ScreenShareSession(
      sessionId,
      monitorIndex,
      this.screenshotHandler,
      onFrame,
      fps,
    );
    this.sessions.set(sessionId, session);
    session.start();
    return session;
  }

  getSession(sessionId: string): ScreenShareSession | undefined {
    return this.sessions.get(sessionId);
  }

  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stop();
      this.sessions.delete(sessionId);
    }
  }

  stopAll(): void {
    for (const session of this.sessions.values()) {
      session.stop();
    }
    this.sessions.clear();
  }
}

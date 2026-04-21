import { ScreenshotHandler } from "../screenshot/handler.js";

export class ScreenShareSession {
  readonly sessionId: string;
  readonly monitorIndex: number;

  private captureInterval: ReturnType<typeof setInterval> | null = null;
  private screenshotHandler: ScreenshotHandler;
  private onFrame: (imageBase64: string, width: number, height: number) => void;
  private fps: number;
  private capturing = false;

  constructor(
    sessionId: string,
    monitorIndex: number,
    screenshotHandler: ScreenshotHandler,
    onFrame: (imageBase64: string, width: number, height: number) => void,
    fps = 5,
  ) {
    this.sessionId = sessionId;
    this.monitorIndex = monitorIndex;
    this.screenshotHandler = screenshotHandler;
    this.onFrame = onFrame;
    this.fps = fps;
  }

  start(): void {
    if (this.captureInterval) return;

    const interval = 1000 / this.fps;

    this.captureInterval = setInterval(async () => {
      if (this.capturing) return; // Skip if previous capture still running
      this.capturing = true;
      try {
        const result = await this.screenshotHandler.captureMonitor(this.monitorIndex);
        this.onFrame(result.imageBase64, result.width, result.height);
      } catch {
        // Capture can fail transiently
      } finally {
        this.capturing = false;
      }
    }, interval);

    console.log(`[ScreenShare] Session ${this.sessionId} started (${this.fps}fps, monitor ${this.monitorIndex})`);
  }

  stop(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    console.log(`[ScreenShare] Session ${this.sessionId} stopped`);
  }
}

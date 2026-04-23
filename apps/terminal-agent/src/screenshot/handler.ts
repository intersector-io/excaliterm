import screenshot from "screenshot-desktop";

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
}

const FALLBACK_MONITOR: MonitorInfo = { index: 0, name: "Primary Display", width: 0, height: 0 };

function parseJpegDimensions(buf: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < buf.length) {
    const marker = buf.readUInt16BE(offset);
    offset += 2;
    if (marker >= 0xffc0 && marker <= 0xffc3) {
      return {
        height: buf.readUInt16BE(offset + 3),
        width: buf.readUInt16BE(offset + 5),
      };
    }
    offset += buf.readUInt16BE(offset);
  }
  return { width: 0, height: 0 };
}

export class ScreenshotHandler {
  private displayCache: Awaited<ReturnType<typeof screenshot.listDisplays>> | null = null;
  private displayCacheTime = 0;
  private readonly displayCacheTtlMs = 30_000;
  private readonly loggedMonitors = new Set<number>();
  private readonly dimensionCache = new Map<number, { width: number; height: number }>();

  private async getDisplays() {
    const now = Date.now();
    if (this.displayCache && now - this.displayCacheTime < this.displayCacheTtlMs) {
      return this.displayCache;
    }
    this.displayCache = await screenshot.listDisplays();
    this.displayCacheTime = now;
    return this.displayCache;
  }

  async listMonitors(): Promise<MonitorInfo[]> {
    try {
      const displays = await this.getDisplays();
      if (displays.length === 0) {
        return [FALLBACK_MONITOR];
      }
      return displays.map((d, i) => ({
        index: i,
        name: d.name || `Display ${i + 1}`,
        width: 0,
        height: 0,
      }));
    } catch (err) {
      console.error("[Screenshot] Failed to list monitors:", (err as Error).message);
      return [FALLBACK_MONITOR];
    }
  }

  async captureMonitor(monitorIndex: number): Promise<{
    imageBase64: string;
    width: number;
    height: number;
  }> {
    const displays = await this.getDisplays();
    const display = displays[monitorIndex] ?? displays[0];
    if (!display) {
      throw new Error("No displays found");
    }
    const imgBuffer = await screenshot({ screen: display.id, format: "jpg" });

    let dims = this.dimensionCache.get(monitorIndex);
    if (!dims) {
      dims = parseJpegDimensions(imgBuffer);
      if (dims.width > 0 && dims.height > 0) {
        this.dimensionCache.set(monitorIndex, dims);
      }
    }

    if (!this.loggedMonitors.has(monitorIndex)) {
      this.loggedMonitors.add(monitorIndex);
      console.log(`[Screenshot] Captured monitor ${monitorIndex}: ${imgBuffer.length} bytes (${Math.round(imgBuffer.length / 1024)}KB), ${dims.width}x${dims.height}`);
    }

    return {
      imageBase64: imgBuffer.toString("base64"),
      width: dims.width,
      height: dims.height,
    };
  }
}

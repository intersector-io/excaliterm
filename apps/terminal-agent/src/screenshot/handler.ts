import { execFile } from "child_process";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
}

export class ScreenshotHandler {
  async listMonitors(): Promise<MonitorInfo[]> {
    if (process.platform === "win32") {
      return this.listMonitorsWindows();
    }
    return [{ index: 0, name: "Primary Display", width: 0, height: 0 }];
  }

  async captureMonitor(monitorIndex: number): Promise<{
    imageBase64: string;
    width: number;
    height: number;
  }> {
    if (process.platform === "win32") {
      return this.captureWindows(monitorIndex);
    }
    throw new Error("Screenshot not supported on this platform yet");
  }

  private listMonitorsWindows(): Promise<MonitorInfo[]> {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      '[System.Windows.Forms.Screen]::AllScreens | ForEach-Object { "$($_.DeviceName)|$($_.Bounds.Width)|$($_.Bounds.Height)|$($_.Primary)" }',
    ].join("; ");

    return new Promise((resolve) => {
      execFile("powershell.exe", ["-NoProfile", "-Command", script], (err, stdout) => {
        if (err) {
          console.error("[Screenshot] Failed to list monitors:", err.message);
          resolve([{ index: 0, name: "Primary Display", width: 0, height: 0 }]);
          return;
        }
        const monitors = stdout
          .trim()
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line, i) => {
            const [name, w, h, primary] = line.trim().split("|");
            return {
              index: i,
              name: primary === "True" ? `${name} (Primary)` : name,
              width: parseInt(w) || 0,
              height: parseInt(h) || 0,
            };
          });
        resolve(monitors.length > 0 ? monitors : [{ index: 0, name: "Primary Display", width: 0, height: 0 }]);
      });
    });
  }

  private captureWindows(monitorIndex: number): Promise<{
    imageBase64: string;
    width: number;
    height: number;
  }> {
    const tmpFile = join(tmpdir(), `excaliterm_screenshot_${Date.now()}.jpg`);
    const escapedPath = tmpFile.replace(/\\/g, "\\\\");

    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      "$screens = [System.Windows.Forms.Screen]::AllScreens",
      `$idx = ${monitorIndex}`,
      "if ($idx -ge $screens.Length) { $idx = 0 }",
      "$screen = $screens[$idx]",
      "$bounds = $screen.Bounds",
      "$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)",
      "$graphics = [System.Drawing.Graphics]::FromImage($bmp)",
      "$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)",
      "$graphics.Dispose()",
      `$bmp.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Jpeg)`,
      "$bmp.Dispose()",
      '"$($bounds.Width)|$($bounds.Height)"',
    ].join("; ");

    return new Promise((resolve, reject) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-Command", script],
        { timeout: 15000 },
        async (err, stdout) => {
          if (err) {
            reject(new Error(`Screenshot capture failed: ${err.message}`));
            return;
          }
          try {
            const [w, h] = stdout.trim().split("|");
            const imgBuffer = await readFile(tmpFile);
            await unlink(tmpFile).catch(() => {});

            console.log(`[Screenshot] Captured ${imgBuffer.length} bytes (${Math.round(imgBuffer.length / 1024)}KB), ${w}x${h}`);

            resolve({
              imageBase64: imgBuffer.toString("base64"),
              width: parseInt(w) || 0,
              height: parseInt(h) || 0,
            });
          } catch (readErr) {
            reject(new Error(`Failed to read screenshot file: ${readErr}`));
          }
        },
      );
    });
  }
}

import { useState, useEffect } from "react";
import { Monitor, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { MonitorInfo } from "@excaliterm/shared-types";

export type MonitorPickerMode = "screenshot" | "stream";

interface MonitorPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MonitorPickerMode;
  monitors: MonitorInfo[];
  isLoadingMonitors: boolean;
  onScreenshot: (monitorIndex: number) => void;
  onStream: (monitorIndex: number) => void;
  isCapturing: boolean;
}

export function MonitorPickerDialog({
  open,
  onOpenChange,
  mode,
  monitors,
  isLoadingMonitors,
  onScreenshot,
  onStream,
  isCapturing,
}: Readonly<MonitorPickerDialogProps>) {
  const isScreenshotMode = mode === "screenshot";
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when monitors change
  useEffect(() => {
    if (monitors.length > 0) {
      setSelectedIndex(0);
    }
  }, [monitors]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isScreenshotMode ? "Take Screenshot" : "Start Stream"}</DialogTitle>
          <DialogDescription>
            {isScreenshotMode
              ? "Select a monitor to capture."
              : "Select a monitor to stream from the host."}
          </DialogDescription>
        </DialogHeader>

        {isLoadingMonitors && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoadingMonitors && monitors.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No monitors found on the host.
          </div>
        )}
        {!isLoadingMonitors && monitors.length > 0 && (
          <div className="flex flex-col gap-2">
            {monitors.map((monitor) => (
              <button
                key={monitor.index}
                onClick={() => setSelectedIndex(monitor.index)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  selectedIndex === monitor.index
                    ? "border-accent-cyan/40 bg-accent-cyan/10"
                    : "border-border hover:border-muted-foreground/25"
                }`}
              >
                <Monitor
                  className={`h-5 w-5 shrink-0 ${
                    selectedIndex === monitor.index
                      ? "text-accent-cyan"
                      : "text-muted-foreground"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {monitor.name}
                  </div>
                  {monitor.width > 0 && monitor.height > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {monitor.width} x {monitor.height}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCapturing}
          >
            Cancel
          </Button>
          {isScreenshotMode ? (
            <Button
              onClick={() => onScreenshot(selectedIndex)}
              disabled={isCapturing || monitors.length === 0}
              className="gap-1.5"
            >
              {isCapturing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {isCapturing ? "Capturing..." : "Screenshot"}
            </Button>
          ) : (
            <Button
              onClick={() => onStream(selectedIndex)}
              disabled={isCapturing || monitors.length === 0}
              className="gap-1.5"
            >
              <Monitor className="h-3.5 w-3.5" />
              Stream
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

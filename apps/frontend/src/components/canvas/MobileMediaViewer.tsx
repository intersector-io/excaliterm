import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Camera,
  Monitor,
  Play,
  Pause,
  Maximize2,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useScreenShareStore } from "@/stores/screen-share-store";
import type { Screenshot } from "@excaliterm/shared-types";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface MediaItem {
  id: string;
  type: "screenshot" | "stream";
  title: string;
  subtitle: string;
  imageData?: string;
  sessionId?: string;
  width: number;
  height: number;
  capturedAt?: string;
}

/* ─── Media Section for Mobile List ─────────────────────────────────── */

interface MobileMediaSectionProps {
  screenshots: Screenshot[];
}

export function MobileMediaSection({ screenshots }: MobileMediaSectionProps) {
  const streamSessions = useScreenShareStore((s) => s.sessions);
  const [fullscreenItem, setFullscreenItem] = useState<MediaItem | null>(null);

  // Build media items
  const mediaItems: MediaItem[] = [];

  // Add active streams first
  streamSessions.forEach((session) => {
    mediaItems.push({
      id: `stream-${session.sessionId}`,
      type: "stream",
      title: `Monitor ${session.monitorIndex + 1}`,
      subtitle: session.status === "streaming" ? "Live" : "Connecting...",
      sessionId: session.sessionId,
      imageData: session.currentFrame?.imageBase64,
      width: session.currentFrame?.width ?? 1920,
      height: session.currentFrame?.height ?? 1080,
    });
  });

  // Add screenshots
  screenshots.forEach((shot) => {
    mediaItems.push({
      id: shot.id,
      type: "screenshot",
      title: `Monitor ${shot.monitorIndex + 1}`,
      subtitle: shot.capturedAt
        ? new Date(shot.capturedAt).toLocaleTimeString()
        : "",
      imageData: shot.imageData,
      width: shot.width,
      height: shot.height,
      capturedAt: shot.capturedAt,
    });
  });

  if (mediaItems.length === 0) return null;

  const currentIndex = fullscreenItem
    ? mediaItems.findIndex((m) => m.id === fullscreenItem.id)
    : -1;

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    setFullscreenItem(mediaItems[currentIndex - 1] ?? null);
  }, [currentIndex, mediaItems]);

  const handleNext = useCallback(() => {
    if (currentIndex >= mediaItems.length - 1) return;
    setFullscreenItem(mediaItems[currentIndex + 1] ?? null);
  }, [currentIndex, mediaItems]);

  return (
    <>
      <div className="space-y-1.5">
        <h3 className="px-1 text-caption font-medium uppercase tracking-wider text-muted-foreground/60">
          Media ({mediaItems.length})
        </h3>

        {/* Horizontal scroll for thumbnail cards */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {mediaItems.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onTap={() => setFullscreenItem(item)}
            />
          ))}
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreenItem && (
        <MediaFullScreen
          item={fullscreenItem}
          onBack={() => setFullscreenItem(null)}
          onPrev={currentIndex > 0 ? handlePrev : undefined}
          onNext={currentIndex < mediaItems.length - 1 ? handleNext : undefined}
          currentIndex={currentIndex}
          totalCount={mediaItems.length}
        />
      )}
    </>
  );
}

/* ─── Thumbnail Card ────────────────────────────────────────────────── */

function MediaCard({
  item,
  onTap,
}: {
  item: MediaItem;
  onTap: () => void;
}) {
  const isStream = item.type === "stream";
  const hasImage = !!item.imageData;

  return (
    <button
      onClick={onTap}
      className="relative flex-shrink-0 overflow-hidden rounded-xl border border-border-default bg-surface-raised/60 transition-all active:scale-[0.97]"
      style={{ width: 160, height: 120 }}
    >
      {/* Thumbnail image */}
      {hasImage ? (
        <img
          src={`data:image/jpeg;base64,${item.imageData}`}
          alt={item.title}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface-sunken/50">
          {isStream ? (
            <Monitor className="h-6 w-6 text-accent-green/30 animate-pulse" />
          ) : (
            <Camera className="h-6 w-6 text-accent-purple/30" />
          )}
        </div>
      )}

      {/* Overlay badge */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6">
        <div className="flex items-center gap-1.5">
          {isStream ? (
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
              <span className="text-caption font-semibold text-accent-green">
                LIVE
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Camera className="h-3 w-3 text-white/60" />
              <span className="text-caption text-white/70">{item.subtitle}</span>
            </div>
          )}
        </div>
        <span className="text-caption text-white/50 block mt-0.5 truncate">
          {item.title} &middot; {item.width}x{item.height}
        </span>
      </div>

      {/* Live indicator ring */}
      {isStream && hasImage && (
        <div className="absolute top-2 right-2 h-3 w-3 rounded-full border-2 border-accent-green bg-accent-green/40 animate-pulse" />
      )}
    </button>
  );
}

/* ─── Fullscreen Media Overlay ──────────────────────────────────────── */

function MediaFullScreen({
  item,
  onBack,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}: {
  item: MediaItem;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex: number;
  totalCount: number;
}) {
  const [paused, setPaused] = useState(false);
  const isStream = item.type === "stream";

  // For streams, read the latest frame from the store
  const storeSession = useScreenShareStore((s) =>
    item.sessionId ? s.sessions.get(item.sessionId) : undefined,
  );
  const liveFrame = isStream && !paused ? storeSession?.currentFrame : null;
  const displayImage = liveFrame?.imageBase64 ?? item.imageData;

  const handleFullscreen = useCallback(() => {
    const el = document.getElementById("media-fullscreen-content");
    el?.requestFullscreen?.().catch(() => {});
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
        <button
          onClick={onBack}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-surface-raised"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isStream ? (
            <Monitor className="h-4 w-4 shrink-0 text-accent-green/70" />
          ) : (
            <Camera className="h-4 w-4 shrink-0 text-accent-purple/70" />
          )}
          <span className="truncate font-mono text-body-sm font-medium text-foreground">
            {item.title}
          </span>
          {isStream && (
            <span className="flex items-center gap-1 rounded-full border border-accent-green/20 bg-accent-green/10 px-2 py-0.5 text-caption font-semibold text-accent-green">
              <div className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse" />
              {paused ? "PAUSED" : "LIVE"}
            </span>
          )}
          {!isStream && item.capturedAt && (
            <span className="flex items-center gap-1 text-caption text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(item.capturedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isStream && (
            <button
              onClick={() => setPaused((p) => !p)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-surface-raised"
            >
              {paused ? (
                <Play className="h-5 w-5 text-accent-green" />
              ) : (
                <Pause className="h-5 w-5" />
              )}
            </button>
          )}
          <button
            onClick={handleFullscreen}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-surface-raised"
          >
            <Maximize2 className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Image content */}
      <div
        id="media-fullscreen-content"
        className="flex flex-1 items-center justify-center bg-black overflow-hidden"
      >
        {displayImage ? (
          <img
            src={`data:image/jpeg;base64,${displayImage}`}
            alt={item.title}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/30">
            {isStream ? (
              <Monitor className="h-12 w-12 animate-pulse" />
            ) : (
              <Camera className="h-12 w-12" />
            )}
            <span className="text-body-sm">
              {isStream ? "Waiting for stream..." : "No image"}
            </span>
          </div>
        )}
      </div>

      {/* Bottom nav with cycling */}
      {totalCount > 1 && (
        <div className="flex h-12 shrink-0 items-center justify-between border-t border-border bg-card px-2">
          <button
            onClick={onPrev}
            disabled={!onPrev}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-surface-raised disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-caption text-muted-foreground">
            {currentIndex + 1} of {totalCount}
          </span>
          <button
            onClick={onNext}
            disabled={!onNext}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-surface-raised disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Resolution bar */}
      <div className="flex h-8 shrink-0 items-center justify-center bg-surface-sunken border-t border-border-subtle">
        <span className="font-mono text-caption text-muted-foreground/50">
          {liveFrame?.width ?? item.width} x {liveFrame?.height ?? item.height}
        </span>
      </div>
    </div>,
    document.body,
  );
}

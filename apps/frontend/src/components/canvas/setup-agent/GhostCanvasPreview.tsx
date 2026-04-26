interface GhostCanvasPreviewProps {
  workerName: string;
  shellName: string;
  workerSpawned: boolean;
  shellSpawned: boolean;
  workerTrigger: boolean;
  shellTrigger: boolean;
}

export function GhostCanvasPreview({
  workerName,
  shellName,
  workerSpawned,
  shellSpawned,
  workerTrigger,
  shellTrigger,
}: GhostCanvasPreviewProps) {
  // Two terminal nodes side-by-side, each with a trigger node hanging below.
  // Dashed amber outlines (preview) flip to solid on materialization.
  return (
    <div
      className="relative h-44 w-full overflow-hidden rounded-md border border-border-subtle/60"
      style={{
        background:
          "radial-gradient(circle at 0.5px 0.5px, rgba(255,255,255,0.05) 0.5px, transparent 0)",
        backgroundColor: "var(--color-surface-sunken)",
        backgroundSize: "12px 12px",
      }}
    >
      <svg viewBox="0 0 320 176" className="absolute inset-0 h-full w-full">
        {/* Worker terminal */}
        <g
          style={{ transition: "opacity 400ms ease-out" }}
          opacity={workerSpawned ? 1 : 0.55}
        >
          <rect
            x="40"
            y="34"
            width="100"
            height="48"
            rx="4"
            fill={workerSpawned ? "var(--color-card)" : "transparent"}
            stroke={workerSpawned ? "var(--color-accent-amber)" : "var(--color-accent-amber)"}
            strokeWidth="1"
            strokeDasharray={workerSpawned ? "0" : "3 3"}
            opacity={workerSpawned ? 0.9 : 0.55}
          />
          <text
            x="50"
            y="62"
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
            fill="var(--color-foreground)"
            opacity={workerSpawned ? 0.85 : 0.45}
          >
            {workerName.slice(0, 14)}
          </text>
        </g>

        {/* Worker trigger */}
        <g style={{ transition: "opacity 400ms ease-out" }} opacity={workerTrigger ? 1 : 0.4}>
          <line
            x1="90"
            y1="82"
            x2="90"
            y2="118"
            stroke="var(--color-accent-amber)"
            strokeWidth="1"
            strokeDasharray={workerTrigger ? "0" : "3 3"}
            opacity={0.6}
          />
          <rect
            x="76"
            y="118"
            width="28"
            height="28"
            rx="3"
            fill={workerTrigger ? "var(--color-card)" : "transparent"}
            stroke="var(--color-accent-amber)"
            strokeWidth="1"
            strokeDasharray={workerTrigger ? "0" : "3 3"}
            opacity={workerTrigger ? 0.9 : 0.55}
          />
          <circle cx="90" cy="132" r="2.5" fill="var(--color-accent-amber)" opacity="0.85" />
        </g>

        {/* Shell terminal */}
        <g
          style={{ transition: "opacity 400ms ease-out" }}
          opacity={shellSpawned ? 1 : 0.55}
        >
          <rect
            x="180"
            y="34"
            width="100"
            height="48"
            rx="4"
            fill={shellSpawned ? "var(--color-card)" : "transparent"}
            stroke="var(--color-accent-amber)"
            strokeWidth="1"
            strokeDasharray={shellSpawned ? "0" : "3 3"}
            opacity={shellSpawned ? 0.9 : 0.55}
          />
          <text
            x="190"
            y="62"
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
            fill="var(--color-foreground)"
            opacity={shellSpawned ? 0.85 : 0.45}
          >
            {shellName.slice(0, 14)}
          </text>
        </g>

        {/* Shell trigger */}
        <g style={{ transition: "opacity 400ms ease-out" }} opacity={shellTrigger ? 1 : 0.4}>
          <line
            x1="230"
            y1="82"
            x2="230"
            y2="118"
            stroke="var(--color-accent-amber)"
            strokeWidth="1"
            strokeDasharray={shellTrigger ? "0" : "3 3"}
            opacity={0.6}
          />
          <rect
            x="216"
            y="118"
            width="28"
            height="28"
            rx="3"
            fill={shellTrigger ? "var(--color-card)" : "transparent"}
            stroke="var(--color-accent-amber)"
            strokeWidth="1"
            strokeDasharray={shellTrigger ? "0" : "3 3"}
            opacity={shellTrigger ? 0.9 : 0.55}
          />
          <circle cx="230" cy="132" r="2.5" fill="var(--color-accent-amber)" opacity="0.85" />
        </g>
      </svg>

      <div className="absolute left-3 top-2 font-mono text-caption uppercase tracking-[0.18em] text-white/30">
        canvas preview
      </div>
    </div>
  );
}

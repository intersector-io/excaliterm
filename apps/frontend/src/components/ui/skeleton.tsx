import { cn } from "@/lib/utils";

export function Skeleton({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-md bg-white/[0.06] animate-shimmer",
        className,
      )}
    />
  );
}

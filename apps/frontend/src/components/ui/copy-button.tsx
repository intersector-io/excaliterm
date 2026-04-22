import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  copied: boolean;
  onClick: () => void;
  variant?: "ghost" | "plain";
}

function CopyButtonContent({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <>
        <Check className="h-3 w-3 text-accent-green" />
        Copied
      </>
    );
  }
  return (
    <>
      <Copy className="h-3 w-3" />
      Copy
    </>
  );
}

export function CopyButton({ copied, onClick, variant = "ghost" }: CopyButtonProps) {
  if (variant === "plain") {
    return (
      <button
        onClick={onClick}
        className="flex h-6 items-center gap-1 rounded px-2 text-caption text-muted-foreground transition-colors hover:text-foreground"
      >
        <CopyButtonContent copied={copied} />
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 gap-1 px-2 text-caption"
      onClick={onClick}
    >
      <CopyButtonContent copied={copied} />
    </Button>
  );
}

import { useState } from "react";
import { Plug2 } from "lucide-react";
import { ConnectAgentModal } from "./ConnectAgentModal";

export function ConnectAgentButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-caption text-muted-foreground/50 transition-colors hover:bg-white/[0.04] hover:text-muted-foreground"
        title="Connect an agent (MCP)"
      >
        <Plug2 className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Connect an agent</span>
      </button>
      <ConnectAgentModal open={open} onOpenChange={setOpen} />
    </>
  );
}

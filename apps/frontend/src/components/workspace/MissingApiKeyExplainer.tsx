import { KeyRound } from "lucide-react";

export function MissingApiKeyExplainer() {
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-accent-amber/20 bg-accent-amber/[0.06] px-4 py-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" />
        <div className="space-y-1">
          <p className="text-body-sm font-medium text-foreground">
            API key unavailable on this browser
          </p>
          <p className="text-caption leading-relaxed text-muted-foreground">
            The workspace API key is shown only once — at creation — and stored
            in the browser that created it. It can't be recovered from a shared
            link or a different browser, by design.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-body-sm font-medium text-foreground">
          What you can do
        </p>
        <ul className="space-y-1.5 text-caption leading-relaxed text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-muted-foreground/50">•</span>
            <span>
              Open this workspace in the original browser that created it, then
              retry connecting a host there.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-muted-foreground/50">•</span>
            <span>
              Or create a fresh workspace — you'll get a new shareable link and
              a new API key.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

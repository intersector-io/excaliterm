import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { useSetupAgentStore } from "@/stores/setup-agent-store";
import { logWizardEvent } from "@/lib/wizard-telemetry";
import { verifySidecarPipe } from "../lib/verify";

export function StepVerify() {
  const verify = useSetupAgentStore((s) => s.verify);
  const setVerify = useSetupAgentStore((s) => s.setVerify);
  const artifacts = useSetupAgentStore((s) => s.artifacts);
  const identity = useSetupAgentStore((s) => s.identity);
  const setStep = useSetupAgentStore((s) => s.setStep);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (
      !artifacts.shellTriggerId ||
      !artifacts.shellTriggerSecret ||
      !artifacts.shellTerminalId ||
      !artifacts.shellReadToken
    ) {
      return;
    }
    ranRef.current = true;
    void (async () => {
      setVerify({ phase: "firing", outputLines: undefined, errorMessage: undefined });
      const result = await verifySidecarPipe({
        shellTriggerId: artifacts.shellTriggerId!,
        shellTriggerSecret: artifacts.shellTriggerSecret!,
        shellTerminalId: artifacts.shellTerminalId!,
        shellReadToken: artifacts.shellReadToken!,
      });
      if (result.ok) {
        setVerify({ phase: "done", outputLines: result.lines });
        logWizardEvent("verification_succeeded", {});
        setTimeout(() => setStep("checkpoint"), 1200);
      } else {
        setVerify({ phase: "failed", errorMessage: result.reason });
        logWizardEvent("verification_failed", { reason: result.reason });
      }
    })();
  }, [artifacts, setVerify, setStep]);

  function skip() {
    setVerify({ phase: "skipped" });
    logWizardEvent("verification_skipped", {});
    setStep("checkpoint");
  }

  function retry() {
    ranRef.current = false;
    setVerify({ phase: "idle" });
  }

  const fireOk = verify.phase === "reading" || verify.phase === "done";
  const readOk = verify.phase === "done";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-h1 font-semibold tracking-tight">Test the connection.</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          We send a harmless <span className="font-mono">pwd</span> to{" "}
          <span className="font-mono text-foreground/80">{identity.shellName}</span>{" "}
          and read its output back through the public endpoints — exactly the path Claude Code will use.
        </p>
      </div>

      <ol className="flex flex-col gap-2 rounded-md border border-border-subtle/60 bg-surface-sunken p-3.5 font-mono text-caption">
        <li className="flex items-center gap-3">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-sm ${
              fireOk
                ? "border border-accent-green/30 bg-accent-green/10 text-accent-green"
                : verify.phase === "failed"
                  ? "border border-accent-red/40 bg-accent-red/10 text-accent-red"
                  : "border border-accent-amber/30 text-accent-amber"
            }`}
          >
            {fireOk ? <Check className="h-3 w-3" strokeWidth={3} /> : verify.phase === "failed" ? <X className="h-3 w-3" /> : "1"}
          </span>
          <span className="flex-1 text-foreground/80">
            send_terminal(name=&quot;{identity.shellName}&quot;, command=&quot;pwd&quot;)
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-sm ${
              readOk
                ? "border border-accent-green/30 bg-accent-green/10 text-accent-green"
                : verify.phase === "failed"
                  ? "border border-accent-red/40 bg-accent-red/10 text-accent-red"
                  : "border border-white/10 text-white/30"
            }`}
          >
            {readOk ? <Check className="h-3 w-3" strokeWidth={3} /> : verify.phase === "failed" ? <X className="h-3 w-3" /> : "2"}
          </span>
          <span className="flex-1 text-foreground/80">
            read_terminal(name=&quot;{identity.shellName}&quot;, lines=8)
          </span>
        </li>
      </ol>

      {verify.phase === "done" && verify.outputLines && (
        <div className="rounded-md border border-border-subtle/60 bg-surface-sunken px-3 py-2 font-mono text-caption text-foreground/85">
          {verify.outputLines.length === 0 ? (
            <span className="text-muted-foreground">(empty buffer)</span>
          ) : (
            verify.outputLines.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap">{l || " "}</div>
            ))
          )}
        </div>
      )}

      {verify.phase === "failed" && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/[0.06] px-3.5 py-3">
          <p className="text-body-sm text-foreground/90">
            Couldn&apos;t complete the round-trip.
          </p>
          {verify.errorMessage && (
            <p className="mt-1 font-mono text-caption text-accent-red/80">
              {verify.errorMessage}
            </p>
          )}
          <p className="mt-2 text-caption text-muted-foreground">
            The terminal exists, but a public-endpoint call returned an error. Most often this means the host agent dropped or your network blocks outbound webhooks.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={retry}
              className="rounded-md border border-accent-amber/40 bg-accent-amber/15 px-3 py-1.5 font-mono text-caption text-accent-amber hover:bg-accent-amber/20"
            >
              Retry
            </button>
            <button
              onClick={skip}
              className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-caption text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
            >
              Skip and continue
            </button>
          </div>
        </div>
      )}

      {verify.phase !== "failed" && verify.phase !== "done" && (
        <div className="flex items-center justify-end">
          <button
            onClick={skip}
            className="text-caption text-muted-foreground/70 hover:text-foreground"
          >
            skip verification
          </button>
        </div>
      )}
    </div>
  );
}

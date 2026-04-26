import { fireTriggerPublic, readTerminalPublic } from "./public-pipe";

export interface VerifyArgs {
  shellTriggerId: string;
  shellTriggerSecret: string;
  shellTerminalId: string;
  shellReadToken: string;
}

export interface VerifyOk {
  ok: true;
  lines: string[];
}

export interface VerifyErr {
  ok: false;
  reason: string;
}

const PROBE_PROMPT = "pwd";

export async function verifySidecarPipe(
  args: VerifyArgs,
): Promise<VerifyOk | VerifyErr> {
  try {
    await fireTriggerPublic({
      triggerId: args.shellTriggerId,
      triggerSecret: args.shellTriggerSecret,
      prompt: PROBE_PROMPT,
    });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "fire failed",
    };
  }

  // The shell needs a moment to print before output appears in the buffer.
  await new Promise((r) => setTimeout(r, 600));

  let lines: string[] = [];
  try {
    const res = await readTerminalPublic({
      terminalId: args.shellTerminalId,
      readToken: args.shellReadToken,
      lines: 8,
    });
    lines = res.lines;
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "read failed",
    };
  }

  // One retry — buffer race tolerance.
  if (lines.length === 0 || !lines.some((l) => l.length > 0)) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      const res = await readTerminalPublic({
        terminalId: args.shellTerminalId,
        readToken: args.shellReadToken,
        lines: 8,
      });
      lines = res.lines;
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "read failed",
      };
    }
  }

  return { ok: true, lines };
}

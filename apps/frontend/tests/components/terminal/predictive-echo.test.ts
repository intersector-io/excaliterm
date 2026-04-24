import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PredictiveEcho } from "@/components/terminal/predictive-echo";

type FakeTerminal = {
  write: ReturnType<typeof vi.fn>;
  buffer: { active: { type: "normal" | "alternate" } };
  _written: string;
};

function makeTerminal(type: "normal" | "alternate" = "normal"): FakeTerminal {
  const t: FakeTerminal = {
    write: vi.fn((data: string) => {
      t._written += data;
    }),
    buffer: { active: { type } },
    _written: "",
  };
  return t;
}

describe("PredictiveEcho", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes printable input locally and strips it from server echo", () => {
    const t = makeTerminal();
    const p = new PredictiveEcho(t as never);

    p.tryPredict("l");
    expect(t._written).toBe("l");

    const filtered = p.filterOutput("l");
    expect(filtered).toBe("");
  });

  it("passes escape sequences through unchanged", () => {
    const t = makeTerminal();
    const p = new PredictiveEcho(t as never);
    p.tryPredict("ls");

    const filtered = p.filterOutput("\x1b[?2004h\x1b[32mls\x1b[0m");
    expect(filtered).toBe("\x1b[?2004h\x1b[32m\x1b[0m");
  });

  it("skips non-printable input (no local write, no queue growth)", () => {
    const t = makeTerminal();
    const p = new PredictiveEcho(t as never);

    p.tryPredict("\r");
    expect(t._written).toBe("");

    const echo = p.filterOutput("\r\n$ ");
    expect(echo).toBe("\r\n$ ");
  });

  it("does not predict when on the alternate screen", () => {
    const t = makeTerminal("alternate");
    const p = new PredictiveEcho(t as never);

    p.tryPredict("abc");
    expect(t._written).toBe("");
  });

  it("leaves predictions queued when server hasn't responded yet", () => {
    const t = makeTerminal();
    const p = new PredictiveEcho(t as never);

    p.tryPredict("ab");
    const filtered = p.filterOutput("unrelated chunk");
    expect(filtered).toBe("unrelated chunk");

    const echoA = p.filterOutput("a");
    expect(echoA).toBe("");
    const echoB = p.filterOutput("b");
    expect(echoB).toBe("");
  });

  it("erases locally predicted chars when the server never echoes (password prompt)", () => {
    const t = makeTerminal();
    const p = new PredictiveEcho(t as never);

    p.tryPredict("hunter2");
    expect(t._written).toBe("hunter2");

    vi.advanceTimersByTime(1500);

    // Predictor should have issued one \b \b per queued char.
    const expected = "hunter2" + "\b \b".repeat(7);
    expect(t._written).toBe(expected);
  });

  it("stops stripping once a non-matching plain byte appears (avoids false positives)", () => {
    const t = makeTerminal();
    const p = new PredictiveEcho(t as never);

    p.tryPredict("ab");
    // Server output with 'a' buried inside unrelated text: must pass through intact.
    const filtered = p.filterOutput("Xa?b!");
    expect(filtered).toBe("Xa?b!");
  });

  it("reset() clears queue without touching local output", () => {
    const t = makeTerminal();
    const p = new PredictiveEcho(t as never);

    p.tryPredict("abc");
    p.reset();
    expect(t._written).toBe("abc");

    // Queue gone — server echo now passes through as-is.
    expect(p.filterOutput("abc")).toBe("abc");
  });
});

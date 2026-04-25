import { describe, it, expect, vi } from "vitest";
import { readTerminal } from "../src/tools/read.js";
import { sendTerminal } from "../src/tools/send.js";

const config = {
  baseUrl: "http://localhost:3001",
  terminals: { worker: { id: "term-1", readToken: "rt-1" } },
  triggers: { worker: { id: "trig-1", token: "tk-1" } },
};

function mockFetch(response: { status: number; body: unknown; ok?: boolean }) {
  return vi.fn(async () =>
    new Response(typeof response.body === "string" ? response.body : JSON.stringify(response.body), {
      status: response.status,
    }),
  ) as unknown as typeof fetch;
}

describe("read_terminal", () => {
  it("builds a request with the terminal id and read token header", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          terminalId: "term-1",
          lines: ["a", "b"],
          totalLines: 2,
          capturedAt: "2026-01-01T00:00:00.000Z",
        }),
        { status: 200 },
      ),
    );

    const result = await readTerminal(
      config,
      { name: "worker", lines: 50 },
      fetchSpy as unknown as typeof fetch,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("http://localhost:3001/api/terminals/term-1/output?lines=50");
    expect((init as RequestInit).headers).toMatchObject({
      "X-Terminal-Read-Token": "rt-1",
    });
    expect(result.lines).toEqual(["a", "b"]);
  });

  it("uses default 200 lines when not specified", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ terminalId: "term-1", lines: [], totalLines: 0, capturedAt: "" }), {
        status: 200,
      }),
    );

    await readTerminal(config, { name: "worker" }, fetchSpy as unknown as typeof fetch);

    expect(fetchSpy.mock.calls[0]![0]).toContain("lines=200");
  });

  it("throws on unknown name", async () => {
    await expect(
      readTerminal(config, { name: "nope" }, mockFetch({ status: 200, body: {} })),
    ).rejects.toThrow(/No such terminal/);
  });

  it("propagates status code in error message on non-2xx", async () => {
    const f = mockFetch({ status: 401, body: "Invalid token" });
    await expect(readTerminal(config, { name: "worker" }, f)).rejects.toThrow(/HTTP 401/);
  });
});

describe("send_terminal", () => {
  it("posts the prompt with the trigger token", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, firedAt: "2026-01-01T00:00:00.000Z" }), {
        status: 200,
      }),
    );

    const result = await sendTerminal(
      config,
      { name: "worker", command: "ls -la" },
      fetchSpy as unknown as typeof fetch,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("http://localhost:3001/api/triggers/trig-1/fire");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Trigger-Token"]).toBe("tk-1");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Trigger-Require-Idle"]).toBeUndefined();
    expect((init as RequestInit).body).toBe(JSON.stringify({ prompt: "ls -la" }));
    expect(result.ok).toBe(true);
  });

  it("adds X-Trigger-Require-Idle when requireIdleSec is set", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, firedAt: "" }), { status: 200 }),
    );

    await sendTerminal(
      config,
      { name: "worker", command: "ls", requireIdleSec: 30 },
      fetchSpy as unknown as typeof fetch,
    );

    const headers = (fetchSpy.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Trigger-Require-Idle"]).toBe("30");
  });

  it("throws on unknown trigger name", async () => {
    await expect(
      sendTerminal(
        config,
        { name: "nope", command: "ls" },
        mockFetch({ status: 200, body: {} }),
      ),
    ).rejects.toThrow(/No such trigger/);
  });

  it("propagates 409 (terminal busy) verbatim in error message", async () => {
    const f = mockFetch({ status: 409, body: "Terminal busy" });
    await expect(
      sendTerminal(config, { name: "worker", command: "ls" }, f),
    ).rejects.toThrow(/HTTP 409/);
  });
});

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, getTerminal, getTrigger } from "../src/config.js";

function tmpFile(content: string): string {
  const file = path.join(os.tmpdir(), `excaliterm-mcp-test-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(file, content);
  return file;
}

const VALID_CONFIG = {
  baseUrl: "http://localhost:3001",
  terminals: {
    worker: { id: "term-1", readToken: "rt-1" },
  },
  triggers: {
    worker: { id: "trig-1", token: "tk-1" },
  },
};

describe("config loading", () => {
  it("loads a valid config file", () => {
    const path = tmpFile(JSON.stringify(VALID_CONFIG));
    const cfg = loadConfig(path);
    expect(cfg.baseUrl).toBe("http://localhost:3001");
    expect(cfg.terminals.worker.id).toBe("term-1");
    expect(cfg.triggers.worker.token).toBe("tk-1");
  });

  it("throws a clear error when the file does not exist", () => {
    expect(() => loadConfig("/no/such/file.json")).toThrow(/Failed to read/);
  });

  it("throws a clear error on malformed JSON", () => {
    const path = tmpFile("{ not json");
    expect(() => loadConfig(path)).toThrow(/Malformed JSON/);
  });

  it("throws a clear error when baseUrl is missing", () => {
    const path = tmpFile(JSON.stringify({ terminals: {}, triggers: {} }));
    expect(() => loadConfig(path)).toThrow(/Invalid Excaliterm MCP config/);
  });

  it("throws when baseUrl is not a URL", () => {
    const path = tmpFile(
      JSON.stringify({ ...VALID_CONFIG, baseUrl: "not-a-url" }),
    );
    expect(() => loadConfig(path)).toThrow(/Invalid Excaliterm MCP config/);
  });

  it("accepts an empty terminals/triggers object", () => {
    const path = tmpFile(
      JSON.stringify({ baseUrl: "http://x", terminals: {}, triggers: {} }),
    );
    const cfg = loadConfig(path);
    expect(cfg.terminals).toEqual({});
    expect(cfg.triggers).toEqual({});
  });

  it("rejects a terminal entry without readToken", () => {
    const path = tmpFile(
      JSON.stringify({
        baseUrl: "http://x",
        terminals: { broken: { id: "t-1" } },
        triggers: {},
      }),
    );
    expect(() => loadConfig(path)).toThrow(/Invalid Excaliterm MCP config/);
  });
});

describe("name resolution", () => {
  const cfg = {
    baseUrl: "http://x",
    terminals: { worker: { id: "t-1", readToken: "rt-1" } },
    triggers: { worker: { id: "trig-1", token: "tk-1" } },
  };

  it("getTerminal returns the matching ref", () => {
    expect(getTerminal(cfg, "worker").id).toBe("t-1");
  });

  it("getTerminal throws on unknown name with the list of known names", () => {
    expect(() => getTerminal(cfg, "missing")).toThrow(/No such terminal/);
    expect(() => getTerminal(cfg, "missing")).toThrow(/worker/);
  });

  it("getTrigger returns the matching ref", () => {
    expect(getTrigger(cfg, "worker").token).toBe("tk-1");
  });

  it("getTrigger throws on unknown name", () => {
    expect(() => getTrigger(cfg, "nope")).toThrow(/No such trigger/);
  });
});

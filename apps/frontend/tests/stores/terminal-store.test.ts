import { describe, it, expect, beforeEach } from "vitest";
import { useTerminalStore } from "@/stores/terminal-store";

describe("terminal-store", () => {
  beforeEach(() => {
    // Reset store state between tests
    useTerminalStore.setState({ buffers: new Map() });
  });

  it("addOutput stores data correctly", () => {
    const { addOutput, getOutput } = useTerminalStore.getState();

    addOutput("t1", "hello");
    addOutput("t1", " world");

    const output = useTerminalStore.getState().getOutput("t1");
    expect(output).toEqual(["hello", " world"]);
  });

  it("getOutput returns empty array for unknown terminal", () => {
    const output = useTerminalStore.getState().getOutput("unknown-id");
    expect(output).toEqual([]);
  });

  it("clearOutput clears data for a terminal", () => {
    const { addOutput, clearOutput } = useTerminalStore.getState();

    addOutput("t1", "some data");
    addOutput("t1", "more data");
    clearOutput("t1");

    const output = useTerminalStore.getState().getOutput("t1");
    expect(output).toEqual([]);
  });

  it("clearOutput does not affect other terminals", () => {
    const { addOutput, clearOutput } = useTerminalStore.getState();

    addOutput("t1", "data-1");
    addOutput("t2", "data-2");
    clearOutput("t1");

    expect(useTerminalStore.getState().getOutput("t1")).toEqual([]);
    expect(useTerminalStore.getState().getOutput("t2")).toEqual(["data-2"]);
  });

  it("removeTerminal removes the entry entirely", () => {
    const { addOutput, removeTerminal } = useTerminalStore.getState();

    addOutput("t1", "data");
    removeTerminal("t1");

    const state = useTerminalStore.getState();
    expect(state.buffers.has("t1")).toBe(false);
    expect(state.getOutput("t1")).toEqual([]);
  });

  it("multiple terminals have independent buffers", () => {
    const { addOutput } = useTerminalStore.getState();

    addOutput("t1", "alpha");
    addOutput("t2", "beta");
    addOutput("t1", "gamma");

    const state = useTerminalStore.getState();
    expect(state.getOutput("t1")).toEqual(["alpha", "gamma"]);
    expect(state.getOutput("t2")).toEqual(["beta"]);
  });
});

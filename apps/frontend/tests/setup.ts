import "@testing-library/jest-dom";

// Mock ResizeObserver which is not available in jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock xterm.js Terminal class
vi.mock("@xterm/xterm", () => {
  const TerminalMock = vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onResize: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    dispose: vi.fn(),
    loadAddon: vi.fn(),
    cols: 80,
    rows: 24,
    options: {},
  }));

  return { Terminal: TerminalMock };
});

// Mock @xterm/addon-fit
vi.mock("@xterm/addon-fit", () => {
  const FitAddonMock = vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    activate: vi.fn(),
    dispose: vi.fn(),
  }));

  return { FitAddon: FitAddonMock };
});

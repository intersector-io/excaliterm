declare module "screenshot-desktop" {
  interface Display {
    id: string | number;
    name: string;
  }

  interface ScreenshotOptions {
    screen?: string | number;
    format?: "png" | "jpg";
    filename?: string;
  }

  function screenshot(options?: ScreenshotOptions): Promise<Buffer>;

  namespace screenshot {
    function listDisplays(): Promise<Display[]>;
    function all(): Promise<Buffer[]>;
  }

  export = screenshot;
}

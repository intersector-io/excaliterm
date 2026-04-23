import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const CANVAS_PACKAGES = new Set(["@dagrejs/dagre", "@xyflow/react"]);
const FRAMEWORK_PACKAGES = new Set([
  "class-variance-authority",
  "clsx",
  "lucide-react",
  "react",
  "react-dom",
  "scheduler",
  "sonner",
  "tailwind-merge",
  "@tanstack/react-query",
  "wouter",
  "zustand",
]);
const MARKDOWN_PACKAGES = new Set([
  "bail",
  "ccount",
  "character-entities",
  "character-entities-html4",
  "character-entities-legacy",
  "comma-separated-tokens",
  "decode-named-character-reference",
  "devlop",
  "hast-util-from-html",
  "hast-util-from-html-isomorphic",
  "hast-util-heading-rank",
  "hast-util-parse-selector",
  "hast-util-raw",
  "hast-util-to-html",
  "hast-util-to-jsx-runtime",
  "hast-util-to-parse5",
  "hast-util-whitespace",
  "highlight.js",
  "html-url-attributes",
  "is-plain-obj",
  "mdast-util-from-markdown",
  "mdast-util-gfm",
  "mdast-util-gfm-autolink-literal",
  "mdast-util-gfm-footnote",
  "mdast-util-gfm-strikethrough",
  "mdast-util-gfm-table",
  "mdast-util-gfm-task-list-item",
  "mdast-util-to-hast",
  "mdast-util-to-string",
  "mdurl",
  "micromark",
  "micromark-core-commonmark",
  "micromark-extension-gfm",
  "micromark-extension-gfm-autolink-literal",
  "micromark-extension-gfm-footnote",
  "micromark-extension-gfm-strikethrough",
  "micromark-extension-gfm-table",
  "micromark-extension-gfm-tagfilter",
  "micromark-extension-gfm-task-list-item",
  "micromark-util-character",
  "micromark-util-chunked",
  "micromark-util-classify-character",
  "micromark-util-combine-extensions",
  "micromark-util-decode-numeric-character-reference",
  "micromark-util-encode",
  "micromark-util-html-tag-name",
  "micromark-util-normalize-identifier",
  "micromark-util-resolve-all",
  "micromark-util-sanitize-uri",
  "micromark-util-subtokenize",
  "micromark-util-symbol",
  "micromark-util-types",
  "property-information",
  "react-markdown",
  "rehype-highlight",
  "rehype-raw",
  "remark-gfm",
  "remark-parse",
  "remark-rehype",
  "space-separated-tokens",
  "stringify-entities",
  "trough",
  "unified",
  "unist-util-is",
  "unist-util-position",
  "unist-util-stringify-position",
  "unist-util-visit",
  "unist-util-visit-parents",
  "vfile",
  "vfile-message",
  "web-namespaces",
  "zwitch",
]);
const SIGNALR_PACKAGES = new Set(["@microsoft/signalr"]);
const TERMINAL_PACKAGES = new Set(["@xterm/addon-fit", "@xterm/xterm"]);

function getNodeModulePackageName(id: string) {
  const normalizedId = id.replaceAll("\\", "/");
  const nodeModulesIndex = normalizedId.lastIndexOf("/node_modules/");

  if (nodeModulesIndex === -1) return null;

  const pathAfterNodeModules = normalizedId.slice(nodeModulesIndex + 14);
  const [firstPart, secondPart] = pathAfterNodeModules.split("/");

  if (!firstPart) return null;
  if (firstPart.startsWith("@") && secondPart) {
    return `${firstPart}/${secondPart}`;
  }

  return firstPart;
}

function isSignalrPureAnnotationWarning(warning: {
  code?: string;
  id?: string;
  message: string;
}) {
  return (
    warning.code === "INVALID_ANNOTATION" &&
    warning.id?.includes("@microsoft/signalr") &&
    warning.id.endsWith("Utils.js") &&
    warning.message.includes("annotation that Rollup cannot interpret")
  );
}

function getManualChunk(id: string) {
  const packageName = getNodeModulePackageName(id);

  if (!packageName) return undefined;
  if (SIGNALR_PACKAGES.has(packageName)) return "signalr";
  if (CANVAS_PACKAGES.has(packageName)) return "canvas";
  if (TERMINAL_PACKAGES.has(packageName)) return "terminal";
  if (MARKDOWN_PACKAGES.has(packageName)) return "markdown";
  if (
    FRAMEWORK_PACKAGES.has(packageName) ||
    packageName.startsWith("@radix-ui/")
  ) {
    return "framework";
  }

  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/hubs": {
        target: "http://localhost:5000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      },
      onwarn(warning, warn) {
        if (isSignalrPureAnnotationWarning(warning)) {
          return;
        }
        warn(warning);
      },
    },
  },
});

import path from "node:path";
import fs from "node:fs";

export class PathValidator {
  private readonly whitelistedPaths: string[];
  private readonly caseInsensitive: boolean;

  constructor(whitelistedPaths: string[]) {
    this.caseInsensitive = process.platform === "win32";

    // Normalize all whitelisted paths at construction time
    this.whitelistedPaths = whitelistedPaths.map((p) =>
      this.normalizePath(path.resolve(p))
    );
  }

  validate(inputPath: string): string {
    if (!inputPath || inputPath.trim().length === 0) {
      throw new Error("Path cannot be empty.");
    }

    // Reject null bytes
    if (inputPath.includes("\0")) {
      throw new Error("Path contains invalid characters.");
    }

    // Resolve to absolute canonical path
    let canonical: string;
    try {
      canonical = path.resolve(inputPath);
    } catch (err) {
      throw new Error(
        `Invalid path: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Reject if path still contains traversal after normalization
    if (canonical.includes("..")) {
      throw new Error("Path traversal is not allowed.");
    }

    // Resolve symlinks if the path exists
    try {
      if (fs.existsSync(canonical)) {
        canonical = fs.realpathSync(canonical);
      }
    } catch {
      // If we can't resolve symlinks, proceed with the canonical path
    }

    // If no whitelist is configured, allow all paths
    if (this.whitelistedPaths.length === 0) {
      return canonical;
    }

    // Check that the canonical path starts with one of the whitelisted paths
    const normalizedCanonical = this.normalizePath(canonical);

    for (const allowed of this.whitelistedPaths) {
      if (normalizedCanonical === allowed) {
        return canonical;
      }
      const separator = path.sep;
      if (normalizedCanonical.startsWith(allowed + separator)) {
        return canonical;
      }
    }

    throw new Error(`Access to path '${inputPath}' is not allowed.`);
  }

  private normalizePath(p: string): string {
    // Remove trailing separators for consistent comparison
    let normalized = p.replace(/[\\/]+$/, "");
    if (this.caseInsensitive) {
      normalized = normalized.toLowerCase();
    }
    return normalized;
  }
}

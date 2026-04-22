import fsp from "node:fs/promises";
import path from "node:path";
import { PathValidator } from "./validator.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number | null;
  modifiedAt: string | null;
}

export interface FileContent {
  content: string;
  encoding: string;
}

function compareByName(a: FileEntry, b: FileEntry): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export class FileSystemHandler {
  private readonly validator: PathValidator;

  constructor(validator: PathValidator) {
    this.validator = validator;
  }

  async listDirectory(dirPath: string): Promise<FileEntry[]> {
    const validatedPath = this.validator.validate(dirPath);

    const stat = await fsp.stat(validatedPath);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${dirPath}`);
    }

    const dirents = await fsp.readdir(validatedPath, { withFileTypes: true });

    // Collect directories first, then files, both sorted alphabetically
    const dirs: FileEntry[] = [];
    const files: FileEntry[] = [];

    for (const dirent of dirents) {
      const fullPath = path.join(validatedPath, dirent.name);
      try {
        const entryStat = await fsp.stat(fullPath);
        const isDir = dirent.isDirectory();
        const entry: FileEntry = {
          name: dirent.name,
          path: fullPath,
          isDirectory: isDir,
          size: isDir ? null : entryStat.size,
          modifiedAt: new Date(entryStat.mtimeMs).toISOString(),
        };

        if (isDir) {
          dirs.push(entry);
        } else {
          files.push(entry);
        }
      } catch {
        // Skip entries we can't stat (permission errors, etc.)
      }
    }

    dirs.sort(compareByName);
    files.sort(compareByName);

    const entries = [...dirs, ...files];
    console.log(`[FileSystem] Listed directory ${validatedPath}: ${entries.length} entries`);
    return entries;
  }

  async readFile(filePath: string): Promise<FileContent> {
    const validatedPath = this.validator.validate(filePath);

    const stat = await fsp.stat(validatedPath);
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }

    if (stat.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`
      );
    }

    const content = await fsp.readFile(validatedPath, "utf-8");

    console.log(
      `[FileSystem] Read file ${validatedPath}: ${content.length} chars`
    );
    return { content, encoding: "utf-8" };
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const validatedPath = this.validator.validate(filePath);

    // Create parent directories if they don't exist
    const dir = path.dirname(validatedPath);
    await fsp.mkdir(dir, { recursive: true });

    await fsp.writeFile(validatedPath, content, "utf-8");
    console.log(
      `[FileSystem] Wrote file ${validatedPath}: ${content.length} chars`
    );
  }
}

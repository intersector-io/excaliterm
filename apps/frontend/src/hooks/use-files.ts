import { useState, useEffect, useCallback, useRef } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { getFileHub } from "@/lib/signalr-client";
import type {
  FileEntryDto,
  DirectoryListingEvent,
  FileContentEvent,
  FileErrorEvent,
} from "@terminal-proxy/shared-types";

interface UseFilesReturn {
  entries: FileEntryDto[];
  currentPath: string;
  loading: boolean;
  error: string | null;
  listDirectory: (path: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
}

export function useFiles(serviceId: string | null): UseFilesReturn {
  const [entries, setEntries] = useState<FileEntryDto[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track pending operations for promise resolution
  const pendingReadRef = useRef<Map<string, {
    resolve: (content: string) => void;
    reject: (err: Error) => void;
  }>>(new Map());

  const pendingWriteRef = useRef<Map<string, {
    resolve: () => void;
    reject: (err: Error) => void;
  }>>(new Map());

  const pendingListRef = useRef<Map<string, {
    resolve: (entries: FileEntryDto[]) => void;
    reject: (err: Error) => void;
  }>>(new Map());

  useEffect(() => {
    if (!serviceId) return;

    const handleDirectoryListing = (event: DirectoryListingEvent) => {
      if (event.serviceId !== serviceId) return;

      setEntries(event.entries);
      setCurrentPath(event.path);
      setLoading(false);

      const pending = pendingListRef.current.get(event.path);
      if (pending) {
        pending.resolve(event.entries);
        pendingListRef.current.delete(event.path);
      }
    };

    const handleFileContent = (event: FileContentEvent) => {
      if (event.serviceId !== serviceId) return;

      const pendingRead = pendingReadRef.current.get(event.path);
      if (pendingRead) {
        pendingRead.resolve(event.content);
        pendingReadRef.current.delete(event.path);
        return;
      }

      const pendingWrite = pendingWriteRef.current.get(event.path);
      if (pendingWrite) {
        pendingWrite.resolve();
        pendingWriteRef.current.delete(event.path);
      }
    };

    const handleFileError = (event: FileErrorEvent) => {
      if (event.serviceId !== serviceId) return;

      setError(event.error);
      setLoading(false);

      // Reject any pending read
      const pendingRead = pendingReadRef.current.get(event.path);
      if (pendingRead) {
        pendingRead.reject(new Error(event.error));
        pendingReadRef.current.delete(event.path);
      }

      // Reject any pending write
      const pendingWrite = pendingWriteRef.current.get(event.path);
      if (pendingWrite) {
        pendingWrite.reject(new Error(event.error));
        pendingWriteRef.current.delete(event.path);
      }

      // Reject any pending list
      const pendingList = pendingListRef.current.get(event.path);
      if (pendingList) {
        pendingList.reject(new Error(event.error));
        pendingListRef.current.delete(event.path);
      }
    };

    const fileHub = getFileHub();
    fileHub.on("DirectoryListing", handleDirectoryListing);
    fileHub.on("FileContent", handleFileContent);
    fileHub.on("FileError", handleFileError);

    return () => {
      fileHub.off("DirectoryListing", handleDirectoryListing);
      fileHub.off("FileContent", handleFileContent);
      fileHub.off("FileError", handleFileError);
    };
  }, [serviceId]);

  const ensureConnected = useCallback(async () => {
    const fileHub = getFileHub();
    if (fileHub.state === HubConnectionState.Disconnected) {
      await fileHub.start();
    }
  }, []);

  const listDirectory = useCallback(
    async (path: string) => {
      if (!serviceId) return;
      setLoading(true);
      setError(null);

      try {
        await ensureConnected();

        const promise = new Promise<FileEntryDto[]>((resolve, reject) => {
          pendingListRef.current.set(path, { resolve, reject });
          // Timeout after 15 seconds
          setTimeout(() => {
            if (pendingListRef.current.has(path)) {
              pendingListRef.current.delete(path);
              reject(new Error("Request timed out"));
            }
          }, 15_000);
        });

        await getFileHub().invoke("ListDirectory", serviceId, path);
        await promise;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to list directory";
        setError(message);
        setLoading(false);
      }
    },
    [serviceId, ensureConnected],
  );

  const readFile = useCallback(
    async (path: string): Promise<string> => {
      if (!serviceId) throw new Error("No service selected");

      await ensureConnected();

      const promise = new Promise<string>((resolve, reject) => {
        pendingReadRef.current.set(path, { resolve, reject });
        setTimeout(() => {
          if (pendingReadRef.current.has(path)) {
            pendingReadRef.current.delete(path);
            reject(new Error("Request timed out"));
          }
        }, 15_000);
      });

      await getFileHub().invoke("ReadFile", serviceId, path);
      return promise;
    },
    [serviceId, ensureConnected],
  );

  const writeFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      if (!serviceId) throw new Error("No service selected");

      await ensureConnected();

      const promise = new Promise<void>((resolve, reject) => {
        pendingWriteRef.current.set(path, { resolve, reject });
        setTimeout(() => {
          if (pendingWriteRef.current.has(path)) {
            pendingWriteRef.current.delete(path);
            reject(new Error("Request timed out"));
          }
        }, 15_000);
      });

      await getFileHub().invoke("WriteFile", serviceId, path, content);
      return promise;
    },
    [serviceId, ensureConnected],
  );

  return {
    entries,
    currentPath,
    loading,
    error,
    listDirectory,
    readFile,
    writeFile,
  };
}

import { useState, useEffect, useCallback, useRef } from "react";
import { HubConnectionState } from "@microsoft/signalr";
import { getFileHub } from "@/lib/signalr-client";
import type {
  FileEntryDto,
  DirectoryListingEvent,
  FileContentEvent,
  FileErrorEvent,
} from "@excaliterm/shared-types";

const REQUEST_TIMEOUT_MS = 15_000;

interface PendingCallbacks<T = void> {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
}

function createPendingPromise<T>(
  pendingMap: React.RefObject<Map<string, PendingCallbacks<T>>>,
  key: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pendingMap.current.set(key, { resolve, reject });
    setTimeout(() => {
      if (pendingMap.current.has(key)) {
        pendingMap.current.delete(key);
        reject(new Error("Request timed out"));
      }
    }, REQUEST_TIMEOUT_MS);
  });
}

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

  const pendingReadRef = useRef<Map<string, PendingCallbacks<string>>>(new Map());
  const pendingWriteRef = useRef<Map<string, PendingCallbacks>>(new Map());
  const pendingListRef = useRef<Map<string, PendingCallbacks<FileEntryDto[]>>>(new Map());

  useEffect(() => {
    if (!serviceId) return;

    function handleDirectoryListing(event: DirectoryListingEvent) {
      if (event.serviceId !== serviceId) return;

      setEntries(event.entries);
      setCurrentPath(event.path);
      setLoading(false);

      const pending = pendingListRef.current.get(event.path);
      if (pending) {
        pending.resolve(event.entries);
        pendingListRef.current.delete(event.path);
      }
    }

    function handleFileContent(event: FileContentEvent) {
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
    }

    function rejectPending<T>(map: Map<string, PendingCallbacks<T>>, key: string, error: Error) {
      const pending = map.get(key);
      if (pending) {
        pending.reject(error);
        map.delete(key);
      }
    }

    function handleFileError(event: FileErrorEvent) {
      if (event.serviceId !== serviceId) return;

      setError(event.error);
      setLoading(false);

      const error = new Error(event.error);
      rejectPending(pendingReadRef.current, event.path, error);
      rejectPending(pendingWriteRef.current, event.path, error);
      rejectPending(pendingListRef.current, event.path, error);
    }

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

        const promise = createPendingPromise(pendingListRef, path);
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

      const promise = createPendingPromise(pendingReadRef, path);
      await getFileHub().invoke("ReadFile", serviceId, path);
      return promise;
    },
    [serviceId, ensureConnected],
  );

  const writeFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      if (!serviceId) throw new Error("No service selected");

      await ensureConnected();

      const promise = createPendingPromise(pendingWriteRef, path);
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

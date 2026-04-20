import { useEffect, useMemo, useRef } from "react";
import type {
  CollaborationStateEvent,
  CollaboratorJoinedEvent,
  CollaboratorLeftEvent,
  TerminalLockChangedEvent,
  TerminalTypingEvent,
} from "@terminal-proxy/shared-types";
import { getTerminalHub } from "@/lib/signalr-client";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTerminalCollaborationStore } from "@/stores/terminal-collaboration-store";

const TYPING_TTL_MS = 1500;

export function useInitializeTerminalCollaboration() {
  const setSnapshot = useTerminalCollaborationStore((s) => s.setSnapshot);
  const collaboratorJoined = useTerminalCollaborationStore((s) => s.collaboratorJoined);
  const collaboratorLeft = useTerminalCollaborationStore((s) => s.collaboratorLeft);
  const setTerminalLock = useTerminalCollaborationStore((s) => s.setTerminalLock);
  const markTyping = useTerminalCollaborationStore((s) => s.markTyping);
  const clearTyping = useTerminalCollaborationStore((s) => s.clearTyping);
  const clearTerminalState = useTerminalCollaborationStore((s) => s.clearTerminalState);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const terminalHub = getTerminalHub();

    const handleSnapshot = (event: CollaborationStateEvent) => {
      setSnapshot(event);
    };

    const handleCollaboratorJoined = (event: CollaboratorJoinedEvent) => {
      collaboratorJoined(event.collaborator);
    };

    const handleCollaboratorLeft = (event: CollaboratorLeftEvent) => {
      collaboratorLeft(event.clientId);
    };

    const handleTerminalLockChanged = (event: TerminalLockChangedEvent) => {
      setTerminalLock(event);
    };

    const handleTerminalTyping = (event: TerminalTypingEvent) => {
      markTyping(event);

      const key = `${event.terminalId}:${event.clientId}`;
      const existingTimeout = typingTimeoutsRef.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(() => {
        clearTyping(event.terminalId, event.clientId);
        typingTimeoutsRef.current.delete(key);
      }, TYPING_TTL_MS);

      typingTimeoutsRef.current.set(key, timeout);
    };

    const handleTerminalCleared = (event: { terminalId: string }) => {
      clearTerminalState(event.terminalId);
    };

    terminalHub.on("CollaborationState", handleSnapshot);
    terminalHub.on("CollaboratorJoined", handleCollaboratorJoined);
    terminalHub.on("CollaboratorLeft", handleCollaboratorLeft);
    terminalHub.on("TerminalLockChanged", handleTerminalLockChanged);
    terminalHub.on("TerminalTyping", handleTerminalTyping);
    terminalHub.on("TerminalExited", handleTerminalCleared);
    terminalHub.on("TerminalDisconnected", handleTerminalCleared);
    terminalHub.invoke("RequestCollaborationState").catch(() => {});

    return () => {
      terminalHub.off("CollaborationState", handleSnapshot);
      terminalHub.off("CollaboratorJoined", handleCollaboratorJoined);
      terminalHub.off("CollaboratorLeft", handleCollaboratorLeft);
      terminalHub.off("TerminalLockChanged", handleTerminalLockChanged);
      terminalHub.off("TerminalTyping", handleTerminalTyping);
      terminalHub.off("TerminalExited", handleTerminalCleared);
      terminalHub.off("TerminalDisconnected", handleTerminalCleared);

      for (const timeout of typingTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      typingTimeoutsRef.current.clear();
    };
  }, [
    clearTerminalState,
    clearTyping,
    collaboratorJoined,
    collaboratorLeft,
    markTyping,
    setSnapshot,
    setTerminalLock,
  ]);
}

export function useTerminalCollaboration(terminalId?: string) {
  const { collaborator } = useWorkspace();
  const collaboratorsMap = useTerminalCollaborationStore((s) => s.collaborators);
  const locks = useTerminalCollaborationStore((s) => s.locks);
  const typingByTerminal = useTerminalCollaborationStore((s) => s.typingByTerminal);

  const collaborators = useMemo(
    () => Object.values(collaboratorsMap).sort((a, b) => a.joinedAt - b.joinedAt),
    [collaboratorsMap],
  );

  const self = useMemo(
    () => collaborators.find((entry) => entry.clientId === collaborator.clientId) ?? null,
    [collaborator.clientId, collaborators],
  );

  const otherCollaborators = useMemo(
    () => collaborators.filter((entry) => entry.clientId !== collaborator.clientId),
    [collaborator.clientId, collaborators],
  );

  const lockInfo = terminalId ? (locks[terminalId] ?? null) : null;
  const activeTypers = terminalId
    ? Object.values(typingByTerminal[terminalId] ?? {}).filter(
        (entry) => entry.clientId !== collaborator.clientId,
      )
    : [];
  const lockedByCurrentCollaborator = lockInfo?.clientId === collaborator.clientId;
  const lockedByOther = !!lockInfo && !lockedByCurrentCollaborator;

  return {
    collaborators,
    self,
    otherCollaborators,
    collaboratorCount: collaborators.length,
    lockCount: Object.keys(locks).length,
    typingByTerminal,
    lockInfo,
    activeTypers,
    lockedByCurrentCollaborator,
    lockedByOther,
    lockTerminal: async (targetTerminalId: string) => {
      await getTerminalHub().invoke("AcquireTerminalLock", targetTerminalId);
    },
    unlockTerminal: async (targetTerminalId: string) => {
      await getTerminalHub().invoke("ReleaseTerminalLock", targetTerminalId);
    },
  };
}

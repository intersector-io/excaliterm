export interface CollaboratorProfile {
  clientId: string;
  displayName: string;
}

const CLIENT_ID_STORAGE_KEY = "excaliterm.client-id";
const DISPLAY_NAME_STORAGE_KEY = "excaliterm.display-name";

function createAnonymousDisplayName(): string {
  return `Anonymous ${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function getOrCreateCollaboratorProfile(): CollaboratorProfile {
  if (typeof globalThis.window === "undefined") {
    return {
      clientId: "server-render",
      displayName: "Anonymous",
    };
  }

  let clientId = globalThis.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    globalThis.localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  }

  let displayName = globalThis.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
  if (!displayName) {
    displayName = createAnonymousDisplayName();
    globalThis.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName);
  }

  return { clientId, displayName };
}

export function updateCollaboratorDisplayName(displayName: string): CollaboratorProfile {
  const trimmed = displayName.trim() || createAnonymousDisplayName();
  const current = getOrCreateCollaboratorProfile();
  globalThis.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmed);
  return {
    ...current,
    displayName: trimmed,
  };
}

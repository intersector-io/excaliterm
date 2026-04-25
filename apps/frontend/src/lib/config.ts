export function getHubUrl(): string {
  return import.meta.env.VITE_HUB_URL || globalThis.location.origin;
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || globalThis.location.origin;
}

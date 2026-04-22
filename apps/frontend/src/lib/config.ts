export function getHubUrl(): string {
  return import.meta.env.VITE_HUB_URL || globalThis.location.origin;
}

/**
 * Shared terminal status display utilities used across canvas components.
 */

export function getStatusDotColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-accent-green";
    case "error":
      return "bg-accent-red";
    case "disconnected":
      return "bg-accent-amber";
    default:
      return "bg-muted-foreground/40";
  }
}

export function getStatusTextColor(status: string): string {
  switch (status) {
    case "active":
      return "text-accent-green";
    case "error":
      return "text-accent-red";
    case "disconnected":
      return "text-accent-amber";
    default:
      return "text-muted-foreground";
  }
}

export function isStaleStatus(status: string): boolean {
  return status === "error" || status === "disconnected";
}

export function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "active":
      return "bg-accent-green/20 text-accent-green";
    case "error":
      return "bg-accent-red/20 text-accent-red";
    case "exited":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-accent-amber/20 text-accent-amber";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Live";
    case "error":
      return "Error";
    case "disconnected":
      return "Offline";
    case "exited":
      return "Exited";
    default:
      return status;
  }
}

import type { CanvasNode, CanvasEdge } from "@excaliterm/shared-types";
import type { schema } from "../db/index.js";

export function toCanvasNodeResponse(
  row: typeof schema.canvasNode.$inferSelect,
): CanvasNode {
  return {
    id: row.id,
    terminalSessionId: row.terminalSessionId,
    nodeType: row.nodeType,
    noteId: row.noteId,
    screenshotId: row.screenshotId,
    serviceInstanceId: row.serviceInstanceId,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zIndex: row.zIndex,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toCanvasEdgeResponse(
  row: typeof schema.canvasEdge.$inferSelect,
): CanvasEdge {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    sourceNodeId: row.sourceNodeId,
    targetNodeId: row.targetNodeId,
    createdAt: row.createdAt.toISOString(),
  };
}

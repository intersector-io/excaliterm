using Microsoft.AspNetCore.SignalR;
using TerminalProxy.Hub.Auth;
using TerminalProxy.Hub.Models;

namespace TerminalProxy.Hub.Hubs;

public class CanvasHub : BaseHub
{
    public CanvasHub(WorkspaceValidator workspaceValidator, ILogger<CanvasHub> logger)
        : base(workspaceValidator, logger)
    {
    }

    public async Task NodeAdded(CanvasNodeDto node)
    {
        var workspaceId = GetWorkspaceId();
        var userId = GetUserId();
        if (workspaceId is null || userId is null) return;

        Logger.LogDebug("NodeAdded: {NodeId} by {UserId}", node.Id, userId);
        await Clients.OthersInGroup(WorkspaceGroup(workspaceId)).SendAsync(
            "NodeAdded", new NodeAddedMessage(node, userId)
        );
    }

    public async Task NodeMoved(string nodeId, double x, double y)
    {
        var workspaceId = GetWorkspaceId();
        var userId = GetUserId();
        if (workspaceId is null || userId is null) return;

        await Clients.OthersInGroup(WorkspaceGroup(workspaceId)).SendAsync(
            "NodeMoved", new NodeMovedMessage(nodeId, x, y, userId)
        );
    }

    public async Task NodeResized(string nodeId, double width, double height)
    {
        var workspaceId = GetWorkspaceId();
        var userId = GetUserId();
        if (workspaceId is null || userId is null) return;

        await Clients.OthersInGroup(WorkspaceGroup(workspaceId)).SendAsync(
            "NodeResized", new NodeResizedMessage(nodeId, width, height, userId)
        );
    }

    public async Task NodeRemoved(string nodeId)
    {
        var workspaceId = GetWorkspaceId();
        var userId = GetUserId();
        if (workspaceId is null || userId is null) return;

        Logger.LogDebug("NodeRemoved: {NodeId} by {UserId}", nodeId, userId);
        await Clients.OthersInGroup(WorkspaceGroup(workspaceId)).SendAsync(
            "NodeRemoved", new NodeRemovedMessage(nodeId, userId)
        );
    }
}

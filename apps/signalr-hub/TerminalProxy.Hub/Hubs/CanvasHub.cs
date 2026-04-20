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
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId is null || userId is null) return;

        Logger.LogDebug("NodeAdded: {NodeId} by {UserId}", node.Id, userId);
        await Clients.OthersInGroup(TenantGroup(tenantId)).SendAsync(
            "NodeAdded", new NodeAddedMessage(node, userId)
        );
    }

    public async Task NodeMoved(string nodeId, double x, double y)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId is null || userId is null) return;

        await Clients.OthersInGroup(TenantGroup(tenantId)).SendAsync(
            "NodeMoved", new NodeMovedMessage(nodeId, x, y, userId)
        );
    }

    public async Task NodeResized(string nodeId, double width, double height)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId is null || userId is null) return;

        await Clients.OthersInGroup(TenantGroup(tenantId)).SendAsync(
            "NodeResized", new NodeResizedMessage(nodeId, width, height, userId)
        );
    }

    public async Task NodeRemoved(string nodeId)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        if (tenantId is null || userId is null) return;

        Logger.LogDebug("NodeRemoved: {NodeId} by {UserId}", nodeId, userId);
        await Clients.OthersInGroup(TenantGroup(tenantId)).SendAsync(
            "NodeRemoved", new NodeRemovedMessage(nodeId, userId)
        );
    }
}

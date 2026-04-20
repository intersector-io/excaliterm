using Microsoft.AspNetCore.SignalR;
using TerminalProxy.Hub.Auth;
using TerminalProxy.Hub.Models;

namespace TerminalProxy.Hub.Hubs;

public class ChatHub : BaseHub
{
    public ChatHub(WorkspaceValidator workspaceValidator, ILogger<ChatHub> logger)
        : base(workspaceValidator, logger)
    {
    }

    public async Task SendMessage(string content)
    {
        var tenantId = GetTenantId();
        var userId = GetUserId();
        var userName = GetUserName();
        if (tenantId is null || userId is null) return;

        var message = new ChatMessageDto(
            Id: Guid.NewGuid().ToString(),
            UserId: userId,
            UserName: userName ?? "Unknown",
            TenantId: tenantId,
            Content: content,
            Timestamp: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        );

        Logger.LogDebug("ChatMessage from {UserId} in tenant {TenantId}", userId, tenantId);
        await Clients.Group(TenantGroup(tenantId)).SendAsync("ReceiveMessage", message);
    }
}

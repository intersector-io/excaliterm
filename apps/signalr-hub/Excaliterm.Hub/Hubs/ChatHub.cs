using Microsoft.AspNetCore.SignalR;
using Excaliterm.Hub.Auth;
using Excaliterm.Hub.Models;

namespace Excaliterm.Hub.Hubs;

public class ChatHub : BaseHub
{
    public ChatHub(WorkspaceValidator workspaceValidator, ILogger<ChatHub> logger)
        : base(workspaceValidator, logger)
    {
    }

    public async Task SendMessage(string content)
    {
        var workspaceId = GetWorkspaceId();
        var userId = GetUserId();
        var userName = GetUserName();
        if (workspaceId is null || userId is null) return;

        var message = new ChatMessageDto(
            Id: Guid.NewGuid().ToString(),
            UserId: userId,
            UserName: userName ?? "Unknown",
            WorkspaceId: workspaceId,
            Content: content,
            Timestamp: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        );

        Logger.LogDebug("ChatMessage from {UserId} in workspace {WorkspaceId}", userId, workspaceId);
        await Clients.Group(WorkspaceGroup(workspaceId)).SendAsync("ReceiveMessage", message);
    }
}

using Microsoft.AspNetCore.SignalR;
using Excaliterm.Hub.Auth;

namespace Excaliterm.Hub.Hubs;

public abstract class BaseHub : Microsoft.AspNetCore.SignalR.Hub
{
    protected readonly WorkspaceValidator WorkspaceValidator;
    protected readonly ILogger Logger;

    protected BaseHub(WorkspaceValidator workspaceValidator, ILogger logger)
    {
        WorkspaceValidator = workspaceValidator;
        Logger = logger;
    }

    protected string? GetUserId() => Context.Items["UserId"] as string;

    protected string? GetWorkspaceId() => Context.Items["WorkspaceId"] as string;

    protected string? GetUserName() => Context.Items["UserName"] as string;

    protected string WorkspaceGroup(string workspaceId) => $"workspace:{workspaceId}";

    protected bool IsServiceConnection() => Context.Items.ContainsKey("IsService");

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();

        // Check for service API key first (terminal-agent connections)
        var apiKey = httpContext?.Request.Query["apiKey"].ToString();
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            // Service connections are authenticated via API key in subclasses
            await base.OnConnectedAsync();
            return;
        }

        // Browser clients join anonymously via shared workspace link.
        var workspaceId = httpContext?.Request.Query["workspaceId"].ToString();
        var clientId = httpContext?.Request.Query["clientId"].ToString();
        var displayName = SanitizeDisplayName(
            httpContext?.Request.Query["displayName"].ToString()
        );

        if (string.IsNullOrWhiteSpace(clientId))
        {
            Logger.LogWarning("Anonymous connection rejected: missing clientId for {ConnectionId}", Context.ConnectionId);
            Context.Abort();
            return;
        }

        var workspaceExists = await WorkspaceValidator.ValidateAsync(workspaceId);
        if (!workspaceExists)
        {
            Logger.LogWarning(
                "Anonymous connection rejected: invalid workspace {WorkspaceId} for {ConnectionId}",
                workspaceId, Context.ConnectionId
            );
            Context.Abort();
            return;
        }

        Context.Items["UserId"] = clientId;
        Context.Items["WorkspaceId"] = workspaceId;
        Context.Items["UserName"] = displayName;

        await Groups.AddToGroupAsync(Context.ConnectionId, WorkspaceGroup(workspaceId!));
        Logger.LogInformation(
            "Anonymous client connected: {ConnectionId} user={UserId} workspace={WorkspaceId}",
            Context.ConnectionId, clientId, workspaceId
        );

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, WorkspaceGroup(workspaceId));
        }

        Logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    private static string SanitizeDisplayName(string? displayName)
    {
        var trimmed = displayName?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            return "Anonymous";

        return trimmed.Length > 50
            ? trimmed[..50]
            : trimmed;
    }
}

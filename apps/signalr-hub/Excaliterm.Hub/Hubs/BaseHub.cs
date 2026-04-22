using Microsoft.AspNetCore.SignalR;
using Excaliterm.Hub.Auth;
using Excaliterm.Hub.Services;

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

    protected string WorkspaceGroup(string workspaceId) => FormatWorkspaceGroup(workspaceId);

    public static string FormatWorkspaceGroup(string workspaceId) => $"workspace:{workspaceId}";

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

    /// <summary>
    /// Shared service registration flow: validates API key, sets context items,
    /// registers in ServiceRegistry, joins workspace group, and acknowledges.
    /// Returns false (and aborts the connection) if validation fails.
    /// </summary>
    protected async Task<bool> RegisterServiceAsync(
        string serviceId,
        string apiKey,
        string hubType,
        ApiKeyValidator apiKeyValidator,
        ServiceRegistry serviceRegistry)
    {
        var httpContext = Context.GetHttpContext();
        var workspaceId = httpContext?.Request.Query["workspaceId"].ToString() ?? "default";

        var isValid = await apiKeyValidator.ValidateAsync(workspaceId, apiKey);
        if (!isValid)
        {
            Logger.LogWarning(
                "Service registration rejected: invalid API key from {ConnectionId} for workspace {WorkspaceId}",
                Context.ConnectionId, workspaceId
            );
            Context.Abort();
            return false;
        }

        Context.Items["IsService"] = true;
        Context.Items["ServiceId"] = serviceId;
        Context.Items["WorkspaceId"] = workspaceId;

        serviceRegistry.Register(Context.ConnectionId, serviceId, workspaceId, hubType);
        await Groups.AddToGroupAsync(Context.ConnectionId, WorkspaceGroup(workspaceId));

        Logger.LogInformation(
            "Service registered: {ServiceId} on connection {ConnectionId} for workspace {WorkspaceId} (hub={HubType})",
            serviceId, Context.ConnectionId, workspaceId, hubType
        );

        await Clients.Caller.SendAsync("ServiceRegistered", serviceId);
        return true;
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

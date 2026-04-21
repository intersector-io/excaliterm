using Microsoft.AspNetCore.SignalR;
using TerminalProxy.Hub.Auth;
using TerminalProxy.Hub.Models;
using TerminalProxy.Hub.Services;

namespace TerminalProxy.Hub.Hubs;

public class FileHub : BaseHub
{
    private readonly ServiceRegistry _serviceRegistry;
    private readonly IConfiguration _config;

    // Default whitelisted base paths; can be overridden per-service from DB/cache
    private static readonly string[] DefaultAllowedBasePaths = ["/app", "/home", "/var/log"];

    public FileHub(WorkspaceValidator workspaceValidator, ServiceRegistry serviceRegistry, IConfiguration config, ILogger<FileHub> logger)
        : base(workspaceValidator, logger)
    {
        _serviceRegistry = serviceRegistry;
        _config = config;
    }

    // ─── Service registration ─────────────────────────────────────────────────

    public async Task RegisterService(string serviceId, string apiKey)
    {
        var expectedKey = _config["ServiceAuth:ApiKey"]
            ?? Environment.GetEnvironmentVariable("SERVICE_API_KEY");

        if (string.IsNullOrWhiteSpace(expectedKey) || apiKey != expectedKey)
        {
            Logger.LogWarning("File Hub: service registration rejected from {ConnectionId}", Context.ConnectionId);
            Context.Abort();
            return;
        }

        var httpContext = Context.GetHttpContext();
        var workspaceId = httpContext?.Request.Query["workspaceId"].ToString() ?? "default";

        Context.Items["IsService"] = true;
        Context.Items["ServiceId"] = serviceId;
        Context.Items["WorkspaceId"] = workspaceId;

        _serviceRegistry.Register(Context.ConnectionId, serviceId, workspaceId, "file");

        Logger.LogInformation("File Hub: service {ServiceId} registered on {ConnectionId}", serviceId, Context.ConnectionId);
        await Clients.Caller.SendAsync("ServiceRegistered", serviceId);
    }

    public async Task ListDirectory(string serviceId, string path)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        if (!ValidatePath(path))
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Path not allowed"));
            return;
        }

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Service not found or offline"));
            return;
        }

        // Verify the service belongs to the same workspace
        if (service.WorkspaceId != workspaceId)
        {
            Logger.LogWarning(
                "Workspace mismatch: user workspace {UserWorkspace} tried to access service in workspace {ServiceWorkspace}",
                workspaceId, service.WorkspaceId
            );
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Access denied"));
            return;
        }

        Logger.LogDebug("ListDirectory: {Path} on service {ServiceId} by {ConnectionId}", path, serviceId, Context.ConnectionId);

        // Store the caller's connection ID so the response can be routed back
        await Clients.Client(service.ConnectionId).SendAsync(
            "ListDirectory", Context.ConnectionId, serviceId, path
        );
    }

    public async Task ReadFile(string serviceId, string path)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        if (!ValidatePath(path))
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Path not allowed"));
            return;
        }

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Service not found or offline"));
            return;
        }

        if (service.WorkspaceId != workspaceId)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Access denied"));
            return;
        }

        Logger.LogDebug("ReadFile: {Path} on service {ServiceId}", path, serviceId);
        await Clients.Client(service.ConnectionId).SendAsync(
            "ReadFile", Context.ConnectionId, serviceId, path
        );
    }

    public async Task WriteFile(string serviceId, string path, string content)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        if (!ValidatePath(path))
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Path not allowed"));
            return;
        }

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Service not found or offline"));
            return;
        }

        if (service.WorkspaceId != workspaceId)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Access denied"));
            return;
        }

        Logger.LogDebug("WriteFile: {Path} on service {ServiceId}", path, serviceId);
        await Clients.Client(service.ConnectionId).SendAsync(
            "WriteFile", Context.ConnectionId, serviceId, path, content
        );
    }

    // ─── Response relay (from service back to browser client) ───────────────────

    public async Task DirectoryListingResponse(string callerConnectionId, DirectoryListingMessage listing)
    {
        if (!IsServiceConnection()) return;

        await Clients.Client(callerConnectionId).SendAsync("DirectoryListing", listing);
    }

    public async Task FileContentResponse(string callerConnectionId, FileContentMessage content)
    {
        if (!IsServiceConnection()) return;

        await Clients.Client(callerConnectionId).SendAsync("FileContent", content);
    }

    public async Task FileErrorResponse(string callerConnectionId, FileErrorMessage error)
    {
        if (!IsServiceConnection()) return;

        await Clients.Client(callerConnectionId).SendAsync("FileError", error);
    }

    // ─── Path validation ────────────────────────────────────────────────────────

    private static bool ValidatePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return false;

        // Reject obvious traversal patterns before normalization
        if (path.Contains("..") || path.Contains('\0'))
            return false;

        // Normalize the path
        string normalized;
        try
        {
            normalized = Path.GetFullPath(path);
        }
        catch
        {
            return false;
        }

        // Double-check no traversal after normalization
        if (normalized.Contains(".."))
            return false;

        // Check against whitelisted base paths
        return DefaultAllowedBasePaths.Any(basePath =>
            normalized.StartsWith(basePath, StringComparison.OrdinalIgnoreCase)
        );
    }
}

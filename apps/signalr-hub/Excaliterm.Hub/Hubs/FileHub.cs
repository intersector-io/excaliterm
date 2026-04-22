using Microsoft.AspNetCore.SignalR;
using Excaliterm.Hub.Auth;
using Excaliterm.Hub.Models;
using Excaliterm.Hub.Services;

namespace Excaliterm.Hub.Hubs;

public class FileHub : BaseHub
{
    private readonly ServiceRegistry _serviceRegistry;
    private readonly ApiKeyValidator _apiKeyValidator;

    // Default whitelisted base paths; can be overridden per-service from DB/cache
    private static readonly string[] DefaultAllowedBasePaths = ["/app", "/home", "/var/log"];

    public FileHub(WorkspaceValidator workspaceValidator, ServiceRegistry serviceRegistry, ApiKeyValidator apiKeyValidator, ILogger<FileHub> logger)
        : base(workspaceValidator, logger)
    {
        _serviceRegistry = serviceRegistry;
        _apiKeyValidator = apiKeyValidator;
    }

    // ─── Service registration ─────────────────────────────────────────────────

    public async Task RegisterService(string serviceId, string apiKey)
    {
        var httpContext = Context.GetHttpContext();
        var workspaceId = httpContext?.Request.Query["workspaceId"].ToString() ?? "default";

        var isValid = await _apiKeyValidator.ValidateAsync(workspaceId, apiKey);
        if (!isValid)
        {
            Logger.LogWarning("File Hub: service registration rejected from {ConnectionId} for workspace {WorkspaceId}", Context.ConnectionId, workspaceId);
            Context.Abort();
            return;
        }

        Context.Items["IsService"] = true;
        Context.Items["ServiceId"] = serviceId;
        Context.Items["WorkspaceId"] = workspaceId;

        _serviceRegistry.Register(Context.ConnectionId, serviceId, workspaceId, "file");

        // Add service to workspace group so it can broadcast events
        await Groups.AddToGroupAsync(Context.ConnectionId, WorkspaceGroup(workspaceId));

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

        var fileConnId = GetFileConnectionId(serviceId);
        if (fileConnId is null) return;

        Logger.LogDebug("ListDirectory: {Path} on service {ServiceId} by {ConnectionId}", path, serviceId, Context.ConnectionId);

        await Clients.Client(fileConnId).SendAsync(
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

        var fileConnId = GetFileConnectionId(serviceId);
        if (fileConnId is null) return;

        Logger.LogDebug("ReadFile: {Path} on service {ServiceId}", path, serviceId);
        await Clients.Client(fileConnId).SendAsync(
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

        var fileConnId = GetFileConnectionId(serviceId);
        if (fileConnId is null) return;

        Logger.LogDebug("WriteFile: {Path} on service {ServiceId}", path, serviceId);
        await Clients.Client(fileConnId).SendAsync(
            "WriteFile", Context.ConnectionId, serviceId, path, content
        );
    }

    // ─── Monitor / Screenshot methods ──────────────────────────────────────────

    public async Task ListMonitors(string serviceId)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, "", "Service not found or offline"));
            return;
        }

        if (service.WorkspaceId != workspaceId)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, "", "Access denied"));
            return;
        }

        var fileConnId = GetFileConnectionId(serviceId);
        if (fileConnId is null)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, "", "Service file hub connection not found"));
            return;
        }

        Logger.LogDebug("ListMonitors on service {ServiceId} by {ConnectionId}", serviceId, Context.ConnectionId);
        await Clients.Client(fileConnId).SendAsync("ListMonitors", Context.ConnectionId, serviceId);
    }

    public async Task CaptureScreenshot(string serviceId, int monitorIndex)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, "", "Service not found or offline"));
            return;
        }

        if (service.WorkspaceId != workspaceId)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, "", "Access denied"));
            return;
        }

        var fileConnId = GetFileConnectionId(serviceId);
        if (fileConnId is null) return;

        Logger.LogDebug("CaptureScreenshot: monitor {MonitorIndex} on service {ServiceId}", monitorIndex, serviceId);
        await Clients.Client(fileConnId).SendAsync("CaptureScreenshot", Context.ConnectionId, serviceId, monitorIndex);
    }

    // ─── WebRTC signaling ────────────────────────────────────────────────────────

    public async Task StartScreenShare(string serviceId, int monitorIndex)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, "", "Service not found or offline"));
            return;
        }

        if (service.WorkspaceId != workspaceId)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, "", "Access denied"));
            return;
        }

        var fileConnId = GetFileConnectionId(serviceId);
        if (fileConnId is null) return;

        Logger.LogDebug("StartScreenShare: monitor {MonitorIndex} on service {ServiceId}", monitorIndex, serviceId);
        await Clients.Client(fileConnId).SendAsync("StartScreenShare", Context.ConnectionId, serviceId, monitorIndex);
    }

    public async Task StopScreenShare(string serviceId, string sessionId)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null) return;

        if (service.WorkspaceId != workspaceId) return;

        var fileConnId = GetFileConnectionId(serviceId);
        if (fileConnId is null) return;

        Logger.LogDebug("StopScreenShare: session {SessionId} on service {ServiceId}", sessionId, serviceId);
        await Clients.Client(fileConnId).SendAsync("StopScreenShare", Context.ConnectionId, serviceId, sessionId);
    }

    public async Task ScreenShareAnswer(string serviceId, string sessionId, string sdp, string type)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null) return;

        if (service.WorkspaceId != workspaceId) return;

        var fileConnId = GetFileConnectionId(serviceId);
        if (fileConnId is null) return;

        await Clients.Client(fileConnId).SendAsync(
            "ScreenShareAnswer", Context.ConnectionId, serviceId, sessionId, sdp, type
        );
    }

    public async Task ScreenShareIceCandidate(string serviceId, string sessionId, string candidate, string? sdpMid, int? sdpMLineIndex)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null) return;

        if (service.WorkspaceId != workspaceId) return;

        var fileConnId = GetFileConnectionId(serviceId);
        if (fileConnId is null) return;

        await Clients.Client(fileConnId).SendAsync(
            "ScreenShareIceCandidate", Context.ConnectionId, serviceId, sessionId, candidate, sdpMid, sdpMLineIndex
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

    public async Task MonitorListResponse(string callerConnectionId, MonitorListingMessage listing)
    {
        if (!IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        if (workspaceId is not null)
        {
            await Clients.Group(WorkspaceGroup(workspaceId)).SendAsync("MonitorListing", listing);
        }
    }

    public async Task ScreenshotResponse(string callerConnectionId, ScreenshotCapturedMessage screenshot)
    {
        if (!IsServiceConnection()) return;

        // Broadcast to workspace group for reliable delivery
        var workspaceId = GetWorkspaceId();
        if (workspaceId is not null)
        {
            await Clients.Group(WorkspaceGroup(workspaceId)).SendAsync("ScreenshotCaptured", screenshot);
        }
    }

    public async Task ScreenShareOfferResponse(string callerConnectionId, WebRtcOfferMessage offer)
    {
        if (!IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        if (workspaceId is not null)
        {
            await Clients.Group(WorkspaceGroup(workspaceId)).SendAsync("ScreenShareOffer", offer);
        }
    }

    public async Task ScreenShareIceCandidateResponse(string callerConnectionId, WebRtcIceCandidateMessage candidate)
    {
        if (!IsServiceConnection()) return;

        await Clients.Client(callerConnectionId).SendAsync("ScreenShareIceCandidateEvent", candidate);
    }

    public async Task ScreenShareFrameResponse(string callerConnectionId, ScreenShareFrameMessage frame)
    {
        if (!IsServiceConnection()) return;

        // Broadcast to workspace group for reliable delivery
        var workspaceId = GetWorkspaceId();
        if (workspaceId is not null)
        {
            await Clients.Group(WorkspaceGroup(workspaceId)).SendAsync("ScreenShareFrame", frame);
        }
    }

    // ─── Helper: resolve FileHub connection for a service ─────────────────────

    private string? GetFileConnectionId(string serviceId)
    {
        return _serviceRegistry.GetFileHubConnection(serviceId)
            ?? _serviceRegistry.GetService(serviceId)?.ConnectionId;
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

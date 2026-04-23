using Microsoft.AspNetCore.SignalR;
using Excaliterm.Hub.Auth;
using Excaliterm.Hub.Models;
using Excaliterm.Hub.Services;

namespace Excaliterm.Hub.Hubs;

public class FileHub : BaseHub
{
    private readonly ServiceRegistry _serviceRegistry;
    private readonly ApiKeyValidator _apiKeyValidator;

    public FileHub(WorkspaceValidator workspaceValidator, ServiceRegistry serviceRegistry, ApiKeyValidator apiKeyValidator, ILogger<FileHub> logger)
        : base(workspaceValidator, logger)
    {
        _serviceRegistry = serviceRegistry;
        _apiKeyValidator = apiKeyValidator;
    }

    // ─── Service registration ─────────────────────────────────────────────────

    public async Task RegisterService(string serviceId, string apiKey)
    {
        await RegisterServiceAsync(serviceId, apiKey, "file", _apiKeyValidator, _serviceRegistry);
    }

    public async Task ListDirectory(string serviceId, string path)
    {
        if (!StructuralPathCheck(path))
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Invalid path"));
            return;
        }

        var fileConnId = await ValidateAndGetFileConnection(serviceId, path);
        if (fileConnId is null) return;

        Logger.LogDebug("ListDirectory: {Path} on service {ServiceId} by {ConnectionId}", path, serviceId, Context.ConnectionId);
        await Clients.Client(fileConnId).SendAsync("ListDirectory", Context.ConnectionId, serviceId, path);
    }

    public async Task ReadFile(string serviceId, string path)
    {
        if (!StructuralPathCheck(path))
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Invalid path"));
            return;
        }

        var fileConnId = await ValidateAndGetFileConnection(serviceId, path);
        if (fileConnId is null) return;

        Logger.LogDebug("ReadFile: {Path} on service {ServiceId}", path, serviceId);
        await Clients.Client(fileConnId).SendAsync("ReadFile", Context.ConnectionId, serviceId, path);
    }

    public async Task WriteFile(string serviceId, string path, string content)
    {
        if (!StructuralPathCheck(path))
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Invalid path"));
            return;
        }

        var fileConnId = await ValidateAndGetFileConnection(serviceId, path);
        if (fileConnId is null) return;

        Logger.LogDebug("WriteFile: {Path} on service {ServiceId}", path, serviceId);
        await Clients.Client(fileConnId).SendAsync("WriteFile", Context.ConnectionId, serviceId, path, content);
    }

    // ─── Monitor / Screenshot methods ──────────────────────────────────────────

    public async Task ListMonitors(string serviceId)
    {
        var fileConnId = await ValidateAndGetFileConnection(serviceId, "");
        if (fileConnId is null) return;

        Logger.LogDebug("ListMonitors on service {ServiceId} by {ConnectionId}", serviceId, Context.ConnectionId);
        await Clients.Client(fileConnId).SendAsync("ListMonitors", Context.ConnectionId, serviceId);
    }

    public async Task CaptureScreenshot(string serviceId, int monitorIndex)
    {
        var fileConnId = await ValidateAndGetFileConnection(serviceId, "");
        if (fileConnId is null) return;

        Logger.LogDebug("CaptureScreenshot: monitor {MonitorIndex} on service {ServiceId}", monitorIndex, serviceId);
        await Clients.Client(fileConnId).SendAsync("CaptureScreenshot", Context.ConnectionId, serviceId, monitorIndex);
    }

    // ─── WebRTC signaling ────────────────────────────────────────────────────────

    public async Task StartScreenShare(string serviceId, int monitorIndex)
    {
        var fileConnId = await ValidateAndGetFileConnection(serviceId, "");
        if (fileConnId is null) return;

        Logger.LogDebug("StartScreenShare: monitor {MonitorIndex} on service {ServiceId}", monitorIndex, serviceId);
        await Clients.Client(fileConnId).SendAsync("StartScreenShare", Context.ConnectionId, serviceId, monitorIndex);
    }

    public async Task StopScreenShare(string serviceId, string sessionId)
    {
        var fileConnId = await ValidateAndGetFileConnection(serviceId, "", sendErrors: false);
        if (fileConnId is null) return;

        Logger.LogDebug("StopScreenShare: session {SessionId} on service {ServiceId}", sessionId, serviceId);
        await Clients.Client(fileConnId).SendAsync("StopScreenShare", Context.ConnectionId, serviceId, sessionId);
    }

    public async Task ScreenShareAnswer(string serviceId, string sessionId, string sdp, string type)
    {
        var fileConnId = await ValidateAndGetFileConnection(serviceId, "", sendErrors: false);
        if (fileConnId is null) return;

        await Clients.Client(fileConnId).SendAsync(
            "ScreenShareAnswer", Context.ConnectionId, serviceId, sessionId, sdp, type
        );
    }

    public async Task ScreenShareIceCandidate(string serviceId, string sessionId, string candidate, string? sdpMid, int? sdpMLineIndex)
    {
        var fileConnId = await ValidateAndGetFileConnection(serviceId, "", sendErrors: false);
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

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Validates workspace access for the service and returns the file hub connection ID.
    /// Sends appropriate error messages to the caller on failure. Returns null if validation fails.
    /// </summary>
    private async Task<string?> ValidateAndGetFileConnection(string serviceId, string path, bool sendErrors = true)
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return null;

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null)
        {
            if (sendErrors)
                await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Service not found or offline"));
            return null;
        }

        if (service.WorkspaceId != workspaceId)
        {
            if (sendErrors)
                await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Access denied"));
            return null;
        }

        var fileConnId = _serviceRegistry.GetFileHubConnection(serviceId)
            ?? service.ConnectionId;

        if (fileConnId is null && sendErrors)
        {
            await Clients.Caller.SendAsync("FileError", new FileErrorMessage(serviceId, path, "Service file hub connection not found"));
        }

        return fileConnId;
    }

    // ─── Path validation ────────────────────────────────────────────────────────

    /// <summary>
    /// Structural sanity check only. Filesystem-level authorization lives on the
    /// terminal-agent (see PathValidator in apps/terminal-agent), which knows the
    /// actual OS, user, and configured WHITELISTED_PATHS. The hub cannot enforce
    /// those rules correctly for remote agents running on a different OS.
    /// </summary>
    private static bool StructuralPathCheck(string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        if (path.Contains('\0')) return false;
        return true;
    }
}

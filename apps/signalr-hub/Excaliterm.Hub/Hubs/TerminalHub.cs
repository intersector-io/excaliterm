using Microsoft.AspNetCore.SignalR;
using StackExchange.Redis;
using Excaliterm.Hub.Auth;
using Excaliterm.Hub.Models;
using Excaliterm.Hub.Services;

namespace Excaliterm.Hub.Hubs;

public class TerminalHub : BaseHub
{
    private const int MaxBufferEntries = 1000;
    private static readonly TimeSpan BufferTtl = TimeSpan.FromHours(24);

    private readonly ServiceRegistry _serviceRegistry;
    private readonly TerminalCollaborationRegistry _collaborationRegistry;
    private readonly ApiKeyValidator _apiKeyValidator;
    private readonly RedisSubscriber _redisSubscriber;
    private readonly IConnectionMultiplexer? _redis;

    public TerminalHub(
        WorkspaceValidator workspaceValidator,
        ServiceRegistry serviceRegistry,
        TerminalCollaborationRegistry collaborationRegistry,
        RedisSubscriber redisSubscriber,
        ApiKeyValidator apiKeyValidator,
        ILogger<TerminalHub> logger,
        IConnectionMultiplexer? redis = null)
        : base(workspaceValidator, logger)
    {
        _serviceRegistry = serviceRegistry;
        _collaborationRegistry = collaborationRegistry;
        _redisSubscriber = redisSubscriber;
        _apiKeyValidator = apiKeyValidator;
        _redis = redis;
    }

    public override async Task OnConnectedAsync()
    {
        // Check if this is a service connection
        var httpContext = Context.GetHttpContext();
        var apiKey = httpContext?.Request.Query["apiKey"].ToString();

        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            // Service connections bypass normal auth, handled in RegisterService
            Context.Items["IsService"] = true;
            Logger.LogInformation("Service connection initiated: {ConnectionId}", Context.ConnectionId);
            await base.OnConnectedAsync();
            return;
        }

        // Browser clients join anonymously via shared workspace link.
        await base.OnConnectedAsync();

        if (IsServiceConnection())
            return;

        var workspaceId = GetWorkspaceId();
        var clientId = GetUserId();
        var displayName = GetUserName();
        if (workspaceId is null || clientId is null || displayName is null)
            return;

        var wasNewCollaborator = _collaborationRegistry.RegisterConnection(
            Context.ConnectionId,
            workspaceId,
            clientId,
            displayName,
            out var collaborator
        );

        await Clients.Caller.SendAsync("CollaborationState", _collaborationRegistry.GetState(workspaceId));

        if (wasNewCollaborator)
        {
            await Clients.OthersInGroup(WorkspaceGroup(workspaceId)).SendAsync(
                "CollaboratorJoined",
                new CollaboratorJoinedMessage(collaborator)
            );
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Clean up service registration if this was a service connection
        var disconnectInfo = _serviceRegistry.Unregister(Context.ConnectionId);
        if (disconnectInfo is not null)
        {
            Logger.LogInformation(
                "Service disconnected: {ServiceInstanceId} workspace={WorkspaceId}",
                disconnectInfo.Service.ServiceInstanceId, disconnectInfo.Service.WorkspaceId
            );

            foreach (var terminalId in disconnectInfo.TerminalIds)
            {
                await Clients.Group(WorkspaceGroup(disconnectInfo.Service.WorkspaceId)).SendAsync(
                    "TerminalDisconnected",
                    new TerminalDisconnectedMessage(terminalId)
                );

                if (_collaborationRegistry.ReleaseLockForTerminal(terminalId) is not null)
                {
                    await Clients.Group(WorkspaceGroup(disconnectInfo.Service.WorkspaceId)).SendAsync(
                        "TerminalLockChanged",
                        new TerminalLockChangedMessage(terminalId, null)
                    );
                }
            }

            // Notify the workspace group that the service went offline
            await Clients.Group(WorkspaceGroup(disconnectInfo.Service.WorkspaceId)).SendAsync(
                "ServiceOffline", disconnectInfo.Service.ServiceInstanceId
            );

            // Publish to Redis so backend can update DB status
            await _redisSubscriber.PublishServiceEvent(
                "offline",
                disconnectInfo.Service.ServiceInstanceId,
                disconnectInfo.Service.WorkspaceId
            );
        }

        if (!IsServiceConnection())
        {
            var collaboratorDisconnect = _collaborationRegistry.UnregisterConnection(Context.ConnectionId);
            if (collaboratorDisconnect is not null)
            {
                foreach (var releasedLock in collaboratorDisconnect.ReleasedLocks)
                {
                    await Clients.Group(WorkspaceGroup(collaboratorDisconnect.WorkspaceId)).SendAsync(
                        "TerminalLockChanged",
                        new TerminalLockChangedMessage(releasedLock.TerminalId, null)
                    );
                }

                await Clients.Group(WorkspaceGroup(collaboratorDisconnect.WorkspaceId)).SendAsync(
                    "CollaboratorLeft",
                    new CollaboratorLeftMessage(collaboratorDisconnect.ClientId)
                );
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    // ─── Service registration ───────────────────────────────────────────────────

    public async Task RegisterService(string serviceId, string apiKey)
    {
        if (!await RegisterServiceAsync(serviceId, apiKey, "terminal", _apiKeyValidator, _serviceRegistry))
            return;

        var workspaceId = GetWorkspaceId() ?? "default";

        // Publish to Redis so backend can update DB status. The backend
        // publishes service:online-ready once the DB is consistent, and the
        // hub fans out ServiceOnline to the workspace group from there —
        // this avoids clients refetching before the host row and canvas
        // node exist.
        await _redisSubscriber.PublishServiceEvent("online", serviceId, workspaceId);
    }

    // ─── Browser client methods ─────────────────────────────────────────────────

    public async Task RequestCollaborationState()
    {
        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        await Clients.Caller.SendAsync(
            "CollaborationState",
            _collaborationRegistry.GetState(workspaceId)
        );
    }

    public async Task AcquireTerminalLock(string terminalId)
    {
        if (IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        var clientId = GetUserId();
        var displayName = GetUserName();
        if (workspaceId is null || clientId is null || displayName is null) return;

        if (!await EnsureCallerOwnsTerminalAsync(terminalId)) return;

        var acquired = _collaborationRegistry.TryAcquireLock(
            workspaceId,
            terminalId,
            clientId,
            displayName,
            out var lockInfo
        );

        if (!acquired)
        {
            await Clients.Caller.SendAsync(
                "TerminalError",
                new TerminalErrorMessage(
                    terminalId,
                    $"Terminal is locked by {lockInfo?.DisplayName ?? "another collaborator"}"
                )
            );
            return;
        }

        await Clients.Group(WorkspaceGroup(workspaceId)).SendAsync(
            "TerminalLockChanged",
            new TerminalLockChangedMessage(terminalId, lockInfo)
        );
    }

    public async Task ReleaseTerminalLock(string terminalId)
    {
        if (IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        var clientId = GetUserId();
        if (workspaceId is null || clientId is null) return;

        if (!await EnsureCallerOwnsTerminalAsync(terminalId)) return;

        var existing = _collaborationRegistry.GetLock(terminalId);
        if (existing is not null && existing.ClientId != clientId)
        {
            await Clients.Caller.SendAsync(
                "TerminalError",
                new TerminalErrorMessage(
                    terminalId,
                    $"Terminal lock is owned by {existing.DisplayName}"
                )
            );
            return;
        }

        _collaborationRegistry.ReleaseLock(terminalId, clientId, force: true);
        await Clients.Group(WorkspaceGroup(workspaceId)).SendAsync(
            "TerminalLockChanged",
            new TerminalLockChangedMessage(terminalId, null)
        );
    }

    // ─── Host shutdown ───────────────────────────────────────────────────────────

    public async Task ShutdownService(string serviceId)
    {
        if (IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        var service = _serviceRegistry.GetService(serviceId);
        if (service is null)
        {
            await Clients.Caller.SendAsync(
                "TerminalError",
                new TerminalErrorMessage("system", "Service not found or offline")
            );
            return;
        }

        if (service.WorkspaceId != workspaceId)
        {
            await Clients.Caller.SendAsync(
                "TerminalError",
                new TerminalErrorMessage("system", "Access denied")
            );
            return;
        }

        var connectionId = _serviceRegistry.GetTerminalHubConnection(serviceId);
        if (connectionId is null)
        {
            await Clients.Caller.SendAsync(
                "TerminalError",
                new TerminalErrorMessage("system", "Service terminal hub connection not found")
            );
            return;
        }

        Logger.LogInformation("Shutdown requested for service {ServiceId} by {ConnectionId}", serviceId, Context.ConnectionId);

        await Clients.Client(connectionId).SendAsync("ShutdownHost");
        await Clients.Caller.SendAsync("ShutdownInitiated", new ShutdownInitiatedMessage(serviceId));
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Checks if a terminal is locked by someone other than the given client.
    /// Sends a TerminalError to the caller if locked. Returns true if blocked.
    /// </summary>
    private async Task<bool> IsLockedByOtherAsync(string terminalId, string clientId)
    {
        var existingLock = _collaborationRegistry.GetLock(terminalId);
        if (existingLock is null || existingLock.ClientId == clientId)
            return false;

        await Clients.Caller.SendAsync(
            "TerminalError",
            new TerminalErrorMessage(terminalId, $"Terminal is locked by {existingLock.DisplayName}")
        );
        return true;
    }

    /// <summary>
    /// Verifies that the caller's workspace owns the given terminal. Without this
    /// check, any authenticated browser could reach terminals in other workspaces
    /// by passing their IDs directly to the hub.
    ///
    /// On failure, sends TerminalError("Access denied") and returns false.
    /// </summary>
    private async Task<bool> EnsureCallerOwnsTerminalAsync(string terminalId)
    {
        var callerWorkspace = GetWorkspaceId();
        if (callerWorkspace is null)
            return false;

        var owner = _serviceRegistry.GetServiceForTerminal(terminalId);
        if (owner is null || owner.WorkspaceId != callerWorkspace)
        {
            Logger.LogWarning(
                "Blocked cross-workspace terminal access: caller workspace={CallerWorkspace} terminal={TerminalId} connection={ConnectionId}",
                callerWorkspace, terminalId, Context.ConnectionId
            );
            await Clients.Caller.SendAsync(
                "TerminalError",
                new TerminalErrorMessage(terminalId, "Access denied")
            );
            return false;
        }

        return true;
    }

    // ─── Client → Server methods (input routing) ────────────────────────────────

    public async Task TerminalInput(string terminalId, string data)
    {
        if (IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        var clientId = GetUserId();
        var displayName = GetUserName();
        if (workspaceId is null || clientId is null || displayName is null) return;

        if (!await EnsureCallerOwnsTerminalAsync(terminalId)) return;
        if (await IsLockedByOtherAsync(terminalId, clientId)) return;

        // Route input to the service connection that owns this terminal
        var connectionId = _serviceRegistry.GetConnectionForTerminal(terminalId);
        if (connectionId is null)
        {
            Logger.LogWarning("No service connection found for terminal {TerminalId}", terminalId);
            await Clients.Caller.SendAsync(
                "TerminalError",
                new TerminalErrorMessage(terminalId, "Terminal not found or service offline")
            );
            return;
        }

        if (_collaborationRegistry.ShouldBroadcastTyping(terminalId, clientId))
        {
            await Clients.OthersInGroup(WorkspaceGroup(workspaceId)).SendAsync(
                "TerminalTyping",
                new TerminalTypingMessage(
                    terminalId,
                    clientId,
                    displayName,
                    DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                )
            );
        }

        Logger.LogDebug("TerminalInput: {TerminalId} routed to connection {ConnectionId}", terminalId, connectionId);
        await Clients.Client(connectionId).SendAsync("TerminalInput", terminalId, data);
    }

    public async Task TerminalResize(string terminalId, int cols, int rows)
    {
        if (IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        var clientId = GetUserId();
        if (workspaceId is null || clientId is null) return;

        if (!await EnsureCallerOwnsTerminalAsync(terminalId)) return;
        if (await IsLockedByOtherAsync(terminalId, clientId)) return;

        var connectionId = _serviceRegistry.GetConnectionForTerminal(terminalId);
        if (connectionId is null)
        {
            Logger.LogWarning("No service connection found for terminal {TerminalId}", terminalId);
            return;
        }

        Logger.LogDebug(
            "TerminalResize: {TerminalId} to {Cols}x{Rows} routed to {ConnectionId}",
            terminalId, cols, rows, connectionId
        );

        await Clients.Client(connectionId).SendAsync("TerminalResize", terminalId, cols, rows);
    }

    // ─── Server → Client methods (from service to browser clients) ──────────────

    public async Task TerminalOutput(string terminalId, string data)
    {
        if (!IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        // Broadcast output to all clients in the workspace group
        await Clients.Group(WorkspaceGroup(workspaceId)).SendAsync(
            "TerminalOutput",
            new TerminalOutputMessage(terminalId, data)
        );

        // Buffer output in Redis for replay on reconnect
        if (_redis is not null)
        {
            try
            {
                var db = _redis.GetDatabase();
                var key = $"terminal:buffer:{terminalId}";
                await db.ListRightPushAsync(key, data);
                await db.ListTrimAsync(key, -MaxBufferEntries, -1);
                await db.KeyExpireAsync(key, BufferTtl);
            }
            catch (Exception ex)
            {
                Logger.LogWarning(ex, "Failed to buffer terminal output for {TerminalId}", terminalId);
            }
        }
    }

    public async Task RequestTerminalBuffer(string terminalId)
    {
        if (_redis is null) return;
        if (IsServiceConnection()) return;
        if (!await EnsureCallerOwnsTerminalAsync(terminalId)) return;

        try
        {
            var db = _redis.GetDatabase();
            var key = $"terminal:buffer:{terminalId}";
            var entries = await db.ListRangeAsync(key, 0, -1);

            foreach (var entry in entries)
            {
                await Clients.Caller.SendAsync(
                    "TerminalOutput",
                    new TerminalOutputMessage(terminalId, entry!)
                );
            }

            Logger.LogDebug(
                "Replayed {Count} buffer entries for terminal {TerminalId}",
                entries.Length, terminalId
            );
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Failed to replay buffer for terminal {TerminalId}", terminalId);
        }
    }

    public async Task TerminalCreated(string terminalId)
    {
        if (!IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        var serviceId = Context.Items["ServiceId"] as string;
        if (workspaceId is null || serviceId is null) return;

        // Register the terminal in the service registry
        _serviceRegistry.RegisterTerminal(serviceId, terminalId);

        Logger.LogInformation("Terminal created: {TerminalId} on service {ServiceId}", terminalId, serviceId);

        // Broadcast to all browser clients in the workspace group
        await Clients.OthersInGroup(WorkspaceGroup(workspaceId)).SendAsync(
            "TerminalCreated",
            new TerminalCreatedMessage(terminalId)
        );
    }

    public async Task TerminalExited(string terminalId, int exitCode)
    {
        if (!IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        // Unregister the terminal
        _serviceRegistry.UnregisterTerminal(terminalId);

        Logger.LogInformation("Terminal exited: {TerminalId} with code {ExitCode}", terminalId, exitCode);

        await Clients.OthersInGroup(WorkspaceGroup(workspaceId)).SendAsync(
            "TerminalExited",
            new TerminalExitedMessage(terminalId, exitCode)
        );

        if (_collaborationRegistry.ReleaseLockForTerminal(terminalId) is not null)
        {
            await Clients.Group(WorkspaceGroup(workspaceId)).SendAsync(
                "TerminalLockChanged",
                new TerminalLockChangedMessage(terminalId, null)
            );
        }

        // Clean up Redis buffer
        if (_redis is not null)
        {
            try
            {
                var db = _redis.GetDatabase();
                await db.KeyDeleteAsync($"terminal:buffer:{terminalId}");
            }
            catch (Exception ex)
            {
                Logger.LogWarning(ex, "Failed to delete buffer for terminal {TerminalId}", terminalId);
            }
        }
    }

    public async Task TerminalError(string terminalId, string error)
    {
        if (!IsServiceConnection()) return;

        var workspaceId = GetWorkspaceId();
        if (workspaceId is null) return;

        Logger.LogWarning("Terminal error: {TerminalId} - {Error}", terminalId, error);

        await Clients.OthersInGroup(WorkspaceGroup(workspaceId)).SendAsync(
            "TerminalError",
            new TerminalErrorMessage(terminalId, error)
        );
    }
}

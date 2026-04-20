using Microsoft.AspNetCore.SignalR;
using StackExchange.Redis;
using TerminalProxy.Hub.Auth;
using TerminalProxy.Hub.Models;
using TerminalProxy.Hub.Services;

namespace TerminalProxy.Hub.Hubs;

public class TerminalHub : BaseHub
{
    private const int MaxBufferEntries = 1000;
    private static readonly TimeSpan BufferTtl = TimeSpan.FromHours(24);

    private readonly ServiceRegistry _serviceRegistry;
    private readonly TerminalCollaborationRegistry _collaborationRegistry;
    private readonly IConfiguration _config;
    private readonly RedisSubscriber _redisSubscriber;
    private readonly IConnectionMultiplexer? _redis;

    public TerminalHub(
        WorkspaceValidator workspaceValidator,
        ServiceRegistry serviceRegistry,
        TerminalCollaborationRegistry collaborationRegistry,
        RedisSubscriber redisSubscriber,
        IConfiguration config,
        ILogger<TerminalHub> logger,
        IConnectionMultiplexer? redis = null)
        : base(workspaceValidator, logger)
    {
        _serviceRegistry = serviceRegistry;
        _collaborationRegistry = collaborationRegistry;
        _redisSubscriber = redisSubscriber;
        _config = config;
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

        var workspaceId = GetTenantId();
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
            await Clients.OthersInGroup(TenantGroup(workspaceId)).SendAsync(
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
                "Service disconnected: {ServiceInstanceId} tenant={TenantId}",
                disconnectInfo.Service.ServiceInstanceId, disconnectInfo.Service.TenantId
            );

            foreach (var terminalId in disconnectInfo.TerminalIds)
            {
                await Clients.Group(TenantGroup(disconnectInfo.Service.TenantId)).SendAsync(
                    "TerminalDisconnected",
                    new TerminalDisconnectedMessage(terminalId)
                );

                if (_collaborationRegistry.ReleaseLockForTerminal(terminalId) is not null)
                {
                    await Clients.Group(TenantGroup(disconnectInfo.Service.TenantId)).SendAsync(
                        "TerminalLockChanged",
                        new TerminalLockChangedMessage(terminalId, null)
                    );
                }
            }

            // Notify the tenant group that the service went offline
            await Clients.Group(TenantGroup(disconnectInfo.Service.TenantId)).SendAsync(
                "ServiceOffline", disconnectInfo.Service.ServiceInstanceId
            );

            // Publish to Redis so backend can update DB status
            await _redisSubscriber.PublishServiceEvent(
                "offline",
                disconnectInfo.Service.ServiceInstanceId,
                disconnectInfo.Service.TenantId
            );
        }

        if (!IsServiceConnection())
        {
            var collaboratorDisconnect = _collaborationRegistry.UnregisterConnection(Context.ConnectionId);
            if (collaboratorDisconnect is not null)
            {
                foreach (var releasedLock in collaboratorDisconnect.ReleasedLocks)
                {
                    await Clients.Group(TenantGroup(collaboratorDisconnect.WorkspaceId)).SendAsync(
                        "TerminalLockChanged",
                        new TerminalLockChangedMessage(releasedLock.TerminalId, null)
                    );
                }

                await Clients.Group(TenantGroup(collaboratorDisconnect.WorkspaceId)).SendAsync(
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
        // Validate the API key against configuration
        var expectedKey = _config["ServiceAuth:ApiKey"]
            ?? Environment.GetEnvironmentVariable("SERVICE_API_KEY");

        if (string.IsNullOrWhiteSpace(expectedKey) || apiKey != expectedKey)
        {
            Logger.LogWarning(
                "Service registration rejected: invalid API key from {ConnectionId}",
                Context.ConnectionId
            );
            Context.Abort();
            return;
        }

        // Extract tenantId from the SignalR query string
        var httpContext = Context.GetHttpContext();
        var tenantId = httpContext?.Request.Query["tenantId"].ToString() ?? "default";

        Context.Items["IsService"] = true;
        Context.Items["ServiceId"] = serviceId;
        Context.Items["TenantId"] = tenantId;

        _serviceRegistry.Register(Context.ConnectionId, serviceId, tenantId, "terminal");

        // Add the service to the tenant group so it receives tenant broadcasts
        await Groups.AddToGroupAsync(Context.ConnectionId, TenantGroup(tenantId));

        Logger.LogInformation(
            "Service registered: {ServiceId} on connection {ConnectionId} for tenant {TenantId}",
            serviceId, Context.ConnectionId, tenantId
        );

        // Acknowledge registration
        await Clients.Caller.SendAsync("ServiceRegistered", serviceId);

        // Notify the tenant group that the service is online
        await Clients.Group(TenantGroup(tenantId)).SendAsync("ServiceOnline", serviceId);

        // Publish to Redis so backend can update DB status
        await _redisSubscriber.PublishServiceEvent("online", serviceId, tenantId);
    }

    // ─── Browser client methods ─────────────────────────────────────────────────

    public async Task RequestCollaborationState()
    {
        var workspaceId = GetTenantId();
        if (workspaceId is null) return;

        await Clients.Caller.SendAsync(
            "CollaborationState",
            _collaborationRegistry.GetState(workspaceId)
        );
    }

    public async Task AcquireTerminalLock(string terminalId)
    {
        var workspaceId = GetTenantId();
        var clientId = GetUserId();
        var displayName = GetUserName();
        if (workspaceId is null || clientId is null || displayName is null) return;

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

        await Clients.Group(TenantGroup(workspaceId)).SendAsync(
            "TerminalLockChanged",
            new TerminalLockChangedMessage(terminalId, lockInfo)
        );
    }

    public async Task ReleaseTerminalLock(string terminalId)
    {
        var workspaceId = GetTenantId();
        var clientId = GetUserId();
        if (workspaceId is null || clientId is null) return;

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
        await Clients.Group(TenantGroup(workspaceId)).SendAsync(
            "TerminalLockChanged",
            new TerminalLockChangedMessage(terminalId, null)
        );
    }

    // ─── Client → Server methods (input routing) ────────────────────────────────

    public async Task TerminalInput(string terminalId, string data)
    {
        var tenantId = GetTenantId();
        var clientId = GetUserId();
        var displayName = GetUserName();
        if (tenantId is null || clientId is null || displayName is null) return;

        var existingLock = _collaborationRegistry.GetLock(terminalId);
        if (existingLock is not null && existingLock.ClientId != clientId)
        {
            await Clients.Caller.SendAsync(
                "TerminalError",
                new TerminalErrorMessage(
                    terminalId,
                    $"Terminal is locked by {existingLock.DisplayName}"
                )
            );
            return;
        }

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
            await Clients.OthersInGroup(TenantGroup(tenantId)).SendAsync(
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
        var tenantId = GetTenantId();
        var clientId = GetUserId();
        if (tenantId is null || clientId is null) return;

        var existingLock = _collaborationRegistry.GetLock(terminalId);
        if (existingLock is not null && existingLock.ClientId != clientId)
        {
            await Clients.Caller.SendAsync(
                "TerminalError",
                new TerminalErrorMessage(
                    terminalId,
                    $"Terminal is locked by {existingLock.DisplayName}"
                )
            );
            return;
        }

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

        var tenantId = GetTenantId();
        if (tenantId is null) return;

        // Broadcast output to all clients in the tenant group
        await Clients.Group(TenantGroup(tenantId)).SendAsync(
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

        var tenantId = GetTenantId();
        var serviceId = Context.Items["ServiceId"] as string;
        if (tenantId is null || serviceId is null) return;

        // Register the terminal in the service registry
        _serviceRegistry.RegisterTerminal(serviceId, terminalId);

        Logger.LogInformation("Terminal created: {TerminalId} on service {ServiceId}", terminalId, serviceId);

        // Broadcast to all browser clients in the tenant group
        await Clients.OthersInGroup(TenantGroup(tenantId)).SendAsync(
            "TerminalCreated",
            new TerminalCreatedMessage(terminalId)
        );
    }

    public async Task TerminalExited(string terminalId, int exitCode)
    {
        if (!IsServiceConnection()) return;

        var tenantId = GetTenantId();
        if (tenantId is null) return;

        // Unregister the terminal
        _serviceRegistry.UnregisterTerminal(terminalId);

        Logger.LogInformation("Terminal exited: {TerminalId} with code {ExitCode}", terminalId, exitCode);

        await Clients.OthersInGroup(TenantGroup(tenantId)).SendAsync(
            "TerminalExited",
            new TerminalExitedMessage(terminalId, exitCode)
        );

        if (_collaborationRegistry.ReleaseLockForTerminal(terminalId) is not null)
        {
            await Clients.Group(TenantGroup(tenantId)).SendAsync(
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

        var tenantId = GetTenantId();
        if (tenantId is null) return;

        Logger.LogWarning("Terminal error: {TerminalId} - {Error}", terminalId, error);

        await Clients.OthersInGroup(TenantGroup(tenantId)).SendAsync(
            "TerminalError",
            new TerminalErrorMessage(terminalId, error)
        );
    }
}

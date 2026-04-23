using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using StackExchange.Redis;
using Excaliterm.Hub.Hubs;
using Excaliterm.Hub.Models;

namespace Excaliterm.Hub.Services;

public class RedisSubscriber : IHostedService
{
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(2);
    private readonly IConfiguration _config;
    private readonly ILogger<RedisSubscriber> _logger;
    private readonly IHubContext<TerminalHub> _terminalHub;
    private readonly IHubContext<CanvasHub> _canvasHub;
    private readonly IHubContext<ChatHub> _chatHub;
    private readonly ServiceRegistry _serviceRegistry;
    private IConnectionMultiplexer? _redis;
    private ISubscriber? _subscriber;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RedisSubscriber(
        IConfiguration config,
        ILogger<RedisSubscriber> logger,
        IHubContext<TerminalHub> terminalHub,
        IHubContext<CanvasHub> canvasHub,
        IHubContext<ChatHub> chatHub,
        ServiceRegistry serviceRegistry)
    {
        _config = config;
        _logger = logger;
        _terminalHub = terminalHub;
        _canvasHub = canvasHub;
        _chatHub = chatHub;
        _serviceRegistry = serviceRegistry;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var redisEnabled = _config.GetValue<bool>("Redis:Enabled");
        if (!redisEnabled)
        {
            _logger.LogInformation("Redis subscriber is disabled");
            return;
        }

        var connectionString = _config["Redis:ConnectionString"]
            ?? Environment.GetEnvironmentVariable("REDIS_CONNECTION_STRING")
            ?? "localhost:6379";

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                _redis = await ConnectionMultiplexer.ConnectAsync(RedisOptionsBuilder.Build(connectionString));
                _subscriber = _redis.GetSubscriber();

                // Subscribe to terminal commands from the Node.js backend
                await _subscriber.SubscribeAsync(
                    RedisChannel.Literal("terminal:commands"),
                    async (channel, message) => await HandleTerminalCommand(message!)
                );

                // Subscribe to canvas updates from REST API
                await _subscriber.SubscribeAsync(
                    RedisChannel.Literal("canvas:updates"),
                    async (channel, message) => await HandleCanvasUpdate(message!)
                );

                // Subscribe to chat messages
                await _subscriber.SubscribeAsync(
                    RedisChannel.Literal("chat:messages"),
                    async (channel, message) => await HandleChatMessage(message!)
                );

                // Subscribe to service deletions from REST API
                await _subscriber.SubscribeAsync(
                    RedisChannel.Literal("service:deleted"),
                    async (channel, message) => await HandleServiceDeleted(message!)
                );

                _logger.LogInformation("Redis subscriber started on {ConnectionString}", connectionString);
                return;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Failed to connect to Redis at {ConnectionString}. Retrying in {DelaySeconds}s",
                    connectionString,
                    RetryDelay.TotalSeconds
                );
                await Task.Delay(RetryDelay, cancellationToken);
            }
        }
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_subscriber is not null)
        {
            await _subscriber.UnsubscribeAllAsync();
        }

        if (_redis is not null)
        {
            await _redis.CloseAsync();
            _redis.Dispose();
        }

        _logger.LogInformation("Redis subscriber stopped");
    }

    // ─── Publishing ─────────────────────────────────────────────────────────────

    public async Task PublishServiceEvent(string eventName, string serviceInstanceId, string workspaceId)
    {
        if (_redis is null) return;

        var db = _redis.GetDatabase();
        var payload = JsonSerializer.Serialize(new RedisServiceEvent(
            eventName, serviceInstanceId, workspaceId, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        ), JsonOptions);

        await db.PublishAsync(RedisChannel.Literal("service:events"), payload);
        _logger.LogDebug("Published service event: {Event} for {ServiceId}", eventName, serviceInstanceId);
    }

    // ─── Terminal commands ──────────────────────────────────────────────────────

    private async Task HandleTerminalCommand(string message)
    {
        try
        {
            var command = JsonSerializer.Deserialize<RedisTerminalCommand>(message, JsonOptions);

            if (command is null)
            {
                _logger.LogWarning("Received null terminal command from Redis");
                return;
            }

            _logger.LogDebug(
                "Received terminal command: {Command} for terminal {TerminalId} on service {ServiceId}",
                command.Command, command.TerminalId, command.ServiceInstanceId
            );

            // Find the TerminalHub connection for the target service
            string? targetConnectionId = null;
            string? targetServiceId = null;

            if (!string.IsNullOrWhiteSpace(command.ServiceInstanceId))
            {
                targetConnectionId = _serviceRegistry.GetTerminalHubConnection(command.ServiceInstanceId);
                targetServiceId = command.ServiceInstanceId;
            }

            // Fallback: find any service in the workspace
            if (targetConnectionId is null && !string.IsNullOrWhiteSpace(command.WorkspaceId))
            {
                var workspaceServices = _serviceRegistry.GetServicesByWorkspace(command.WorkspaceId);
                foreach (var svc in workspaceServices)
                {
                    var connId = _serviceRegistry.GetTerminalHubConnection(svc.ServiceInstanceId);
                    if (connId is not null)
                    {
                        targetConnectionId = connId;
                        targetServiceId = svc.ServiceInstanceId;
                        break;
                    }
                }
            }

            if (targetConnectionId is null)
            {
                _logger.LogWarning(
                    "No TerminalHub connection found for terminal command {Command} (serviceId={ServiceId}, workspaceId={WorkspaceId})",
                    command.Command, command.ServiceInstanceId, command.WorkspaceId
                );
                return;
            }

            _logger.LogDebug(
                "Routing terminal command {Command} for terminal {TerminalId} to service {ServiceId} on connection {ConnectionId}",
                command.Command, command.TerminalId, targetServiceId, targetConnectionId
            );

            switch (command.Command)
            {
                case "terminal:create":
                    await _terminalHub.Clients.Client(targetConnectionId).SendAsync(
                        "CreateTerminal",
                        command.TerminalId,
                        command.Cols ?? 80,
                        command.Rows ?? 24
                    );
                    break;

                case "terminal:destroy":
                    await _terminalHub.Clients.Client(targetConnectionId).SendAsync(
                        "DestroyTerminal",
                        command.TerminalId
                    );
                    break;

                case "terminal:write":
                    await _terminalHub.Clients.Client(targetConnectionId).SendAsync(
                        "TerminalInput",
                        command.TerminalId,
                        "" // Data would come from an extended command model
                    );
                    break;

                case "terminal:resize":
                    await _terminalHub.Clients.Client(targetConnectionId).SendAsync(
                        "TerminalResize",
                        command.TerminalId,
                        command.Cols ?? 80,
                        command.Rows ?? 24
                    );
                    break;

                default:
                    _logger.LogWarning("Unknown terminal command: {Command}", command.Command);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling terminal command from Redis");
        }
    }

    // ─── Canvas updates ─────────────────────────────────────────────────────────

    private async Task HandleCanvasUpdate(string message)
    {
        try
        {
            var update = JsonSerializer.Deserialize<RedisCanvasUpdate>(message, JsonOptions);
            if (update is null) return;

            var group = BaseHub.FormatWorkspaceGroup(update.WorkspaceId);

            switch (update.Action)
            {
                case "nodeAdded" when update.Node is not null:
                    await _canvasHub.Clients.Group(group).SendAsync(
                        "NodeAdded", new NodeAddedMessage(update.Node, update.UserId)
                    );
                    break;

                case "nodeMoved" when update.NodeId is not null:
                    await _canvasHub.Clients.Group(group).SendAsync(
                        "NodeMoved", new NodeMovedMessage(update.NodeId, update.X ?? 0, update.Y ?? 0, update.UserId)
                    );
                    break;

                case "nodeResized" when update.NodeId is not null:
                    await _canvasHub.Clients.Group(group).SendAsync(
                        "NodeResized", new NodeResizedMessage(update.NodeId, update.Width ?? 0, update.Height ?? 0, update.UserId)
                    );
                    break;

                case "nodeRemoved" when update.NodeId is not null:
                    await _canvasHub.Clients.Group(group).SendAsync(
                        "NodeRemoved", new NodeRemovedMessage(update.NodeId, update.UserId)
                    );
                    break;

                default:
                    _logger.LogWarning("Unknown canvas action: {Action}", update.Action);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling canvas update from Redis");
        }
    }

    // ─── Service deletions ──────────────────────────────────────────────────────

    private async Task HandleServiceDeleted(string message)
    {
        try
        {
            var evt = JsonSerializer.Deserialize<RedisServiceDeleted>(message, JsonOptions);
            if (evt is null) return;

            var group = BaseHub.FormatWorkspaceGroup(evt.WorkspaceId);
            await _terminalHub.Clients.Group(group).SendAsync("ServiceDeleted", evt.ServiceInstanceId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling service deletion from Redis");
        }
    }

    // ─── Chat messages ──────────────────────────────────────────────────────────

    private async Task HandleChatMessage(string message)
    {
        try
        {
            var chatMsg = JsonSerializer.Deserialize<RedisChatMessage>(message, JsonOptions);
            if (chatMsg is null) return;

            var group = BaseHub.FormatWorkspaceGroup(chatMsg.WorkspaceId);
            await _chatHub.Clients.Group(group).SendAsync("ReceiveMessage", chatMsg.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling chat message from Redis");
        }
    }
}

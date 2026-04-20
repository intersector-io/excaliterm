using System.Collections.Concurrent;
using TerminalProxy.Hub.Models;

namespace TerminalProxy.Hub.Services;

public class ServiceRegistry
{
    private readonly ConcurrentDictionary<string, ServiceInstanceInfo> _byConnectionId = new();
    private readonly ConcurrentDictionary<string, ServiceInstanceInfo> _byServiceInstanceId = new();
    // Track terminal hub connections separately from file hub connections
    private readonly ConcurrentDictionary<string, string> _terminalHubConnections = new(); // serviceId -> terminalHub connectionId
    private readonly ConcurrentDictionary<string, string> _terminalToService = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> _serviceToTerminals = new();
    private readonly ILogger<ServiceRegistry> _logger;

    public ServiceRegistry(ILogger<ServiceRegistry> logger)
    {
        _logger = logger;
    }

    public void Register(string connectionId, string serviceInstanceId, string tenantId, string hubType = "terminal")
    {
        var info = new ServiceInstanceInfo(connectionId, serviceInstanceId, tenantId, DateTime.UtcNow);
        _byConnectionId[connectionId] = info;
        _serviceToTerminals.TryAdd(serviceInstanceId, new ConcurrentDictionary<string, byte>());

        if (hubType == "terminal")
        {
            // For TerminalHub connections, this is the primary registration
            _terminalHubConnections[serviceInstanceId] = connectionId;
            _byServiceInstanceId[serviceInstanceId] = info;
        }
        else if (!_byServiceInstanceId.ContainsKey(serviceInstanceId))
        {
            // Only use file hub connection as fallback
            _byServiceInstanceId[serviceInstanceId] = info;
        }

        _logger.LogInformation(
            "Service registered: {ServiceInstanceId} on connection {ConnectionId} for tenant {TenantId} (hub={HubType})",
            serviceInstanceId, connectionId, tenantId, hubType
        );
    }

    /// <summary>Gets the TerminalHub connection ID for a service, preferring the terminal hub connection.</summary>
    public string? GetTerminalHubConnection(string serviceInstanceId)
    {
        return _terminalHubConnections.TryGetValue(serviceInstanceId, out var connId) ? connId : null;
    }

    public ServiceDisconnectInfo? Unregister(string connectionId)
    {
        if (_byConnectionId.TryRemove(connectionId, out var info))
        {
            var terminalIds = Array.Empty<string>();

            // Only remove from main registry if this was the primary connection
            if (_byServiceInstanceId.TryGetValue(info.ServiceInstanceId, out var current)
                && current.ConnectionId == connectionId)
            {
                _byServiceInstanceId.TryRemove(info.ServiceInstanceId, out _);
            }

            // Remove terminal hub connection mapping
            if (_terminalHubConnections.TryGetValue(info.ServiceInstanceId, out var termConn)
                && termConn == connectionId)
            {
                _terminalHubConnections.TryRemove(info.ServiceInstanceId, out _);
            }

            // Clean up all terminals associated with this service
            if (_serviceToTerminals.TryRemove(info.ServiceInstanceId, out var terminals))
            {
                terminalIds = terminals.Keys.ToArray();

                foreach (var terminalId in terminalIds)
                {
                    _terminalToService.TryRemove(terminalId, out _);
                }
            }

            _logger.LogInformation(
                "Service unregistered: {ServiceInstanceId} from connection {ConnectionId}",
                info.ServiceInstanceId, connectionId
            );
            return new ServiceDisconnectInfo(info, terminalIds);
        }

        return null;
    }

    public void RegisterTerminal(string serviceInstanceId, string terminalId)
    {
        _terminalToService[terminalId] = serviceInstanceId;

        if (_serviceToTerminals.TryGetValue(serviceInstanceId, out var terminals))
        {
            terminals.TryAdd(terminalId, 0);
        }

        _logger.LogDebug(
            "Terminal registered: {TerminalId} on service {ServiceInstanceId}",
            terminalId, serviceInstanceId
        );
    }

    public void UnregisterTerminal(string terminalId)
    {
        if (_terminalToService.TryRemove(terminalId, out var serviceId))
        {
            if (_serviceToTerminals.TryGetValue(serviceId, out var terminals))
            {
                terminals.TryRemove(terminalId, out _);
            }

            _logger.LogDebug("Terminal unregistered: {TerminalId}", terminalId);
        }
    }

    public string? GetConnectionForTerminal(string terminalId)
    {
        if (_terminalToService.TryGetValue(terminalId, out var serviceId))
        {
            return GetService(serviceId)?.ConnectionId;
        }

        return null;
    }

    public string? GetConnectionForService(string serviceInstanceId)
    {
        return GetService(serviceInstanceId)?.ConnectionId;
    }

    public ServiceInstanceInfo? GetService(string serviceInstanceId)
    {
        _byServiceInstanceId.TryGetValue(serviceInstanceId, out var info);
        return info;
    }

    public ServiceInstanceInfo? GetServiceByConnectionId(string connectionId)
    {
        _byConnectionId.TryGetValue(connectionId, out var info);
        return info;
    }

    public IReadOnlyList<ServiceInstanceInfo> GetServicesByTenant(string tenantId)
    {
        return _byServiceInstanceId.Values
            .Where(s => s.TenantId == tenantId)
            .ToList()
            .AsReadOnly();
    }

    public bool IsServiceOnline(string serviceInstanceId)
    {
        return _byServiceInstanceId.ContainsKey(serviceInstanceId);
    }
}

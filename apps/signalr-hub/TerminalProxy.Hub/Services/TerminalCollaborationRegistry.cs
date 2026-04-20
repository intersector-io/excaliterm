using System.Collections.Concurrent;
using TerminalProxy.Hub.Models;

namespace TerminalProxy.Hub.Services;

public class TerminalCollaborationRegistry
{
    private static readonly TimeSpan TypingBroadcastThrottle = TimeSpan.FromMilliseconds(800);

    private readonly ConcurrentDictionary<string, CollaboratorConnection> _connections = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, CollaboratorEntry>> _workspaceCollaborators = new();
    private readonly ConcurrentDictionary<string, TerminalLockInfo> _terminalLocks = new();
    private readonly ConcurrentDictionary<string, long> _lastTypingBroadcast = new();

    public bool RegisterConnection(string connectionId, string workspaceId, string clientId, string displayName, out CollaboratorInfo collaborator)
    {
        var joinedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var workspaceEntries = _workspaceCollaborators.GetOrAdd(workspaceId, _ => new ConcurrentDictionary<string, CollaboratorEntry>());

        var wasNewCollaborator = false;
        var entry = workspaceEntries.AddOrUpdate(
            clientId,
            _ =>
            {
                wasNewCollaborator = true;
                return new CollaboratorEntry(clientId, displayName, joinedAt, new HashSet<string> { connectionId });
            },
            (_, existing) =>
            {
                lock (existing.ConnectionIds)
                {
                    existing.ConnectionIds.Add(connectionId);
                }
                existing.DisplayName = displayName;
                return existing;
            }
        );

        _connections[connectionId] = new CollaboratorConnection(workspaceId, clientId);
        collaborator = entry.ToInfo();
        return wasNewCollaborator;
    }

    public DisconnectResult? UnregisterConnection(string connectionId)
    {
        if (!_connections.TryRemove(connectionId, out var connection))
            return null;

        if (!_workspaceCollaborators.TryGetValue(connection.WorkspaceId, out var workspaceEntries))
            return null;

        if (!workspaceEntries.TryGetValue(connection.ClientId, out var entry))
            return null;

        lock (entry.ConnectionIds)
        {
            entry.ConnectionIds.Remove(connectionId);
            if (entry.ConnectionIds.Count > 0)
                return null;
        }

        workspaceEntries.TryRemove(connection.ClientId, out _);
        if (workspaceEntries.IsEmpty)
            _workspaceCollaborators.TryRemove(connection.WorkspaceId, out _);

        var releasedLocks = ReleaseLocksForClient(connection.WorkspaceId, connection.ClientId);
        return new DisconnectResult(connection.WorkspaceId, connection.ClientId, releasedLocks);
    }

    public CollaborationStateMessage GetState(string workspaceId)
    {
        var collaborators = _workspaceCollaborators.TryGetValue(workspaceId, out var workspaceEntries)
            ? workspaceEntries.Values.Select(entry => entry.ToInfo()).OrderBy(info => info.JoinedAt).ToArray()
            : Array.Empty<CollaboratorInfo>();

        var locks = _terminalLocks.Values
            .Where(lockInfo => lockInfo.WorkspaceId == workspaceId)
            .OrderBy(lockInfo => lockInfo.LockedAt)
            .ToArray();

        return new CollaborationStateMessage(collaborators, locks);
    }

    public bool TryAcquireLock(string workspaceId, string terminalId, string clientId, string displayName, out TerminalLockInfo? lockInfo)
    {
        if (_terminalLocks.TryGetValue(terminalId, out var existing))
        {
            if (existing.ClientId == clientId)
            {
                lockInfo = existing;
                return true;
            }

            lockInfo = existing;
            return false;
        }

        var created = new TerminalLockInfo(
            workspaceId,
            terminalId,
            clientId,
            displayName,
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        );

        if (_terminalLocks.TryAdd(terminalId, created))
        {
            lockInfo = created;
            return true;
        }

        return TryAcquireLock(workspaceId, terminalId, clientId, displayName, out lockInfo);
    }

    public TerminalLockInfo? ReleaseLock(string terminalId, string clientId, bool force = false)
    {
        if (!_terminalLocks.TryGetValue(terminalId, out var existing))
            return null;

        if (!force && existing.ClientId != clientId)
            return existing;

        _terminalLocks.TryRemove(terminalId, out _);
        return null;
    }

    public TerminalLockInfo? GetLock(string terminalId)
    {
        _terminalLocks.TryGetValue(terminalId, out var existing);
        return existing;
    }

    public bool ShouldBroadcastTyping(string terminalId, string clientId)
    {
        var key = $"{terminalId}:{clientId}";
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        if (_lastTypingBroadcast.TryGetValue(key, out var previous)
            && now - previous < TypingBroadcastThrottle.TotalMilliseconds)
        {
            return false;
        }

        _lastTypingBroadcast[key] = now;
        return true;
    }

    public TerminalLockInfo? ReleaseLockForTerminal(string terminalId)
    {
        _terminalLocks.TryRemove(terminalId, out var released);
        return released;
    }

    private IReadOnlyList<TerminalLockInfo> ReleaseLocksForClient(string workspaceId, string clientId)
    {
        var released = new List<TerminalLockInfo>();
        foreach (var lockEntry in _terminalLocks)
        {
            if (lockEntry.Value.WorkspaceId != workspaceId || lockEntry.Value.ClientId != clientId)
                continue;

            if (_terminalLocks.TryRemove(lockEntry.Key, out var removed) && removed is not null)
            {
                released.Add(removed);
            }
        }

        return released;
    }

    private sealed class CollaboratorEntry
    {
        public CollaboratorEntry(string clientId, string displayName, long joinedAt, HashSet<string> connectionIds)
        {
            ClientId = clientId;
            DisplayName = displayName;
            JoinedAt = joinedAt;
            ConnectionIds = connectionIds;
        }

        public string ClientId { get; }
        public string DisplayName { get; set; }
        public long JoinedAt { get; }
        public HashSet<string> ConnectionIds { get; }

        public CollaboratorInfo ToInfo()
        {
            return new CollaboratorInfo(ClientId, DisplayName, JoinedAt);
        }
    }

    private sealed record CollaboratorConnection(string WorkspaceId, string ClientId);

    public sealed record DisconnectResult(string WorkspaceId, string ClientId, IReadOnlyList<TerminalLockInfo> ReleasedLocks);
}

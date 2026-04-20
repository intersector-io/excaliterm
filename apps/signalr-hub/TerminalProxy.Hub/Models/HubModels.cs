namespace TerminalProxy.Hub.Models;

// ─── Terminal Hub ────────────────────────────────────────────────────────────

public record TerminalInputRequest(string TerminalId, string Data);

public record TerminalResizeRequest(string TerminalId, int Cols, int Rows);

public record TerminalOutputMessage(string TerminalId, string Data);

public record TerminalCreatedMessage(string TerminalId);

public record TerminalExitedMessage(string TerminalId, int ExitCode);

public record TerminalDisconnectedMessage(string TerminalId);

public record TerminalErrorMessage(string TerminalId, string Error);

public record CollaboratorInfo(string ClientId, string DisplayName, long JoinedAt);

public record TerminalTypingMessage(string TerminalId, string ClientId, string DisplayName, long Timestamp);

public record TerminalLockInfo(string WorkspaceId, string TerminalId, string ClientId, string DisplayName, long LockedAt);

public record CollaborationStateMessage(CollaboratorInfo[] Collaborators, TerminalLockInfo[] Locks);

public record CollaboratorJoinedMessage(CollaboratorInfo Collaborator);

public record CollaboratorLeftMessage(string ClientId);

public record TerminalLockChangedMessage(string TerminalId, TerminalLockInfo? Lock);

// ─── Canvas Hub ──────────────────────────────────────────────────────────────

public record CanvasNodeDto(
    string Id,
    string? TerminalSessionId,
    string UserId,
    double X,
    double Y,
    double Width,
    double Height,
    int ZIndex
);

public record NodeAddedMessage(CanvasNodeDto Node, string UserId);

public record NodeMovedMessage(string NodeId, double X, double Y, string UserId);

public record NodeResizedMessage(string NodeId, double Width, double Height, string UserId);

public record NodeRemovedMessage(string NodeId, string UserId);

// ─── Chat Hub ────────────────────────────────────────────────────────────────

public record ChatMessageDto(
    string Id,
    string UserId,
    string UserName,
    string TenantId,
    string Content,
    long Timestamp
);

public record SendMessageRequest(string Content);

// ─── File Hub ────────────────────────────────────────────────────────────────

public record ListDirectoryRequest(string ServiceId, string Path);

public record ReadFileRequest(string ServiceId, string Path);

public record WriteFileRequest(string ServiceId, string Path, string Content);

public record FileEntryDto(
    string Name,
    string Path,
    bool IsDirectory,
    long? Size,
    string? ModifiedAt
);

public record DirectoryListingMessage(string ServiceId, string Path, FileEntryDto[] Entries);

public record FileContentMessage(string ServiceId, string Path, string Content);

public record FileErrorMessage(string ServiceId, string Path, string Error);

// ─── Auth ────────────────────────────────────────────────────────────────────

public record ValidatedSession(string UserId, string TenantId, string UserName, string? Email);

// ─── Service Registry ────────────────────────────────────────────────────────

public record ServiceInstanceInfo(
    string ConnectionId,
    string ServiceInstanceId,
    string TenantId,
    DateTime RegisteredAt
);

public record ServiceDisconnectInfo(
    ServiceInstanceInfo Service,
    IReadOnlyList<string> TerminalIds
);

// ─── Redis Commands ──────────────────────────────────────────────────────────

public record RedisTerminalCommand(
    string Command,
    string TerminalId,
    string? ServiceInstanceId,
    string? TenantId,
    int? Cols,
    int? Rows
);

public record RedisCanvasUpdate(
    string Action,
    string TenantId,
    string UserId,
    CanvasNodeDto? Node,
    string? NodeId,
    double? X,
    double? Y,
    double? Width,
    double? Height
);

public record RedisChatMessage(
    string TenantId,
    ChatMessageDto Message
);

public record RedisServiceEvent(
    string Event,
    string ServiceInstanceId,
    string TenantId,
    long Timestamp
);

// ─── Service Registration ───────────────────────────────────────────────────

public record RegisterServiceRequest(string ServiceId, string ApiKey);

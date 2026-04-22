using System.Collections.Concurrent;

namespace Excaliterm.Hub.Auth;

public class WorkspaceValidator
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<WorkspaceValidator> _logger;
    private readonly ConcurrentDictionary<string, CachedWorkspace> _cache = new();
    private readonly Timer _evictionTimer;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);

    private record CachedWorkspace(bool Exists, DateTime ExpiresAt);

    public WorkspaceValidator(IHttpClientFactory httpClientFactory, IConfiguration config, ILogger<WorkspaceValidator> logger)
    {
        _httpClient = httpClientFactory.CreateClient("Backend");
        _httpClient.BaseAddress = new Uri(
            config["Backend:Url"]
            ?? Environment.GetEnvironmentVariable("BACKEND_URL")
            ?? "http://localhost:3001"
        );
        _httpClient.Timeout = RequestTimeout;
        _logger = logger;
        _evictionTimer = new Timer(_ => EvictExpiredEntries(), null, CacheTtl, CacheTtl);
    }

    public async Task<bool> ValidateAsync(string? workspaceId)
    {
        if (string.IsNullOrWhiteSpace(workspaceId))
            return false;

        if (_cache.TryGetValue(workspaceId, out var cached) && cached.ExpiresAt > DateTime.UtcNow)
            return cached.Exists;

        try
        {
            using var cts = new CancellationTokenSource(RequestTimeout);
            var response = await _httpClient.GetAsync($"/api/workspaces/{workspaceId}", cts.Token);
            var exists = response.IsSuccessStatusCode;

            _cache[workspaceId] = new CachedWorkspace(exists, DateTime.UtcNow.Add(CacheTtl));

            return exists;
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("Workspace validation timed out for workspace {WorkspaceId}", workspaceId);
            return false;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Backend unavailable during workspace validation");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating workspace {WorkspaceId}", workspaceId);
            return false;
        }
    }

    private void EvictExpiredEntries()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _cache)
        {
            if (kvp.Value.ExpiresAt <= now)
                _cache.TryRemove(kvp.Key, out _);
        }
    }
}

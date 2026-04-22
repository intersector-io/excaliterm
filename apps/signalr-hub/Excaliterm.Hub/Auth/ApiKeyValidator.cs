using System.Collections.Concurrent;
using System.Text.Json;

namespace Excaliterm.Hub.Auth;

public class ApiKeyValidator
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ApiKeyValidator> _logger;
    private readonly ConcurrentDictionary<string, CachedResult> _cache = new();
    private readonly Timer _evictionTimer;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);

    private record CachedResult(bool Valid, DateTime ExpiresAt);

    public ApiKeyValidator(IHttpClientFactory httpClientFactory, IConfiguration config, ILogger<ApiKeyValidator> logger)
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

    public async Task<bool> ValidateAsync(string? workspaceId, string? apiKey)
    {
        if (string.IsNullOrWhiteSpace(workspaceId) || string.IsNullOrWhiteSpace(apiKey))
            return false;

        var cacheKey = $"{workspaceId}:{apiKey}";
        if (_cache.TryGetValue(cacheKey, out var cached) && cached.ExpiresAt > DateTime.UtcNow)
            return cached.Valid;

        try
        {
            using var cts = new CancellationTokenSource(RequestTimeout);
            var response = await _httpClient.GetAsync(
                $"/api/validate-key?workspaceId={Uri.EscapeDataString(workspaceId)}&apiKey={Uri.EscapeDataString(apiKey)}",
                cts.Token
            );

            if (!response.IsSuccessStatusCode)
                return false;

            var json = await response.Content.ReadAsStringAsync(cts.Token);
            var doc = JsonDocument.Parse(json);
            var valid = doc.RootElement.TryGetProperty("valid", out var prop) && prop.GetBoolean();

            _cache[cacheKey] = new CachedResult(valid, DateTime.UtcNow.Add(CacheTtl));

            return valid;
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("API key validation timed out for workspace {WorkspaceId}", workspaceId);
            return false;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Backend unavailable during API key validation");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating API key for workspace {WorkspaceId}", workspaceId);
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

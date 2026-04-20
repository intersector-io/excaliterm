using System.Collections.Concurrent;
using System.Text.Json;
using TerminalProxy.Hub.Models;

namespace TerminalProxy.Hub.Auth;

public class TokenValidator
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<TokenValidator> _logger;
    private readonly ConcurrentDictionary<string, CachedSession> _cache = new();
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(10);

    private record CachedSession(ValidatedSession Session, DateTime ExpiresAt);

    public TokenValidator(IHttpClientFactory httpClientFactory, IConfiguration config, ILogger<TokenValidator> logger)
    {
        _httpClient = httpClientFactory.CreateClient("Backend");
        _httpClient.BaseAddress = new Uri(
            config["Backend:Url"]
            ?? Environment.GetEnvironmentVariable("BACKEND_URL")
            ?? "http://localhost:3001"
        );
        _httpClient.Timeout = RequestTimeout;
        _logger = logger;
    }

    public async Task<ValidatedSession?> ValidateAsync(string? tokenSource)
    {
        if (string.IsNullOrWhiteSpace(tokenSource))
            return null;

        // Check cache
        if (_cache.TryGetValue(tokenSource, out var cached) && cached.ExpiresAt > DateTime.UtcNow)
            return cached.Session;

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "/api/session-info");

            // Determine if this is a cookie or Authorization header
            if (tokenSource.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                request.Headers.Add("Authorization", tokenSource);
            }
            else
            {
                request.Headers.Add("Cookie", tokenSource);
            }

            using var cts = new CancellationTokenSource(RequestTimeout);
            var response = await _httpClient.SendAsync(request, cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Session validation failed with status {Status}", response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync(cts.Token);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Extract session data from better-auth response
            if (!root.TryGetProperty("session", out var sessionEl))
                return null;

            var userId = sessionEl.GetProperty("userId").GetString();
            var tenantId = root.TryGetProperty("tenantId", out var tid) ? tid.GetString() : null;

            // Extract user info
            var userName = root.TryGetProperty("user", out var userEl)
                && userEl.TryGetProperty("name", out var nameEl)
                    ? nameEl.GetString()
                    : null;

            var email = root.TryGetProperty("user", out var userEl2)
                && userEl2.TryGetProperty("email", out var emailEl)
                    ? emailEl.GetString()
                    : null;

            if (userId is null)
                return null;

            var session = new ValidatedSession(userId, tenantId ?? "default", userName ?? "Unknown", email);

            // Cache the validated session
            _cache[tokenSource] = new CachedSession(session, DateTime.UtcNow.Add(CacheTtl));

            // Evict expired entries periodically
            EvictExpiredEntries();

            return session;
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("Session validation timed out");
            return null;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Backend unavailable during session validation");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating session token");
            return null;
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

using StackExchange.Redis;
using Excaliterm.Hub.Auth;
using Excaliterm.Hub.Hubs;
using Excaliterm.Hub.Services;

var builder = WebApplication.CreateBuilder(args);

// ─── Configuration ───────────────────────────────────────────────────────────

var frontendUrl = builder.Configuration["Frontend:Url"]
    ?? Environment.GetEnvironmentVariable("FRONTEND_URL")
    ?? "http://localhost:5173";

var redisConnectionString = builder.Configuration["Redis:ConnectionString"]
    ?? Environment.GetEnvironmentVariable("REDIS_CONNECTION_STRING")
    ?? "localhost:6379";

var redisEnabled = builder.Configuration.GetValue<bool>("Redis:Enabled")
    || Environment.GetEnvironmentVariable("REDIS_ENABLED") == "true";

ConfigurationOptions BuildRedisOptions(string connectionString)
{
    // Handle redis:// URLs (e.g. from Railway Redis addon)
    if (connectionString.StartsWith("redis://") || connectionString.StartsWith("rediss://"))
    {
        var uri = new Uri(connectionString);
        var options = new ConfigurationOptions
        {
            EndPoints = { { uri.Host, uri.Port > 0 ? uri.Port : 6379 } },
            AbortOnConnectFail = false,
            ConnectRetry = 5,
            ReconnectRetryPolicy = new ExponentialRetry(5_000),
            Ssl = uri.Scheme == "rediss",
        };
        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            var parts = uri.UserInfo.Split(':', 2);
            if (parts.Length == 2)
                options.Password = Uri.UnescapeDataString(parts[1]);
        }
        return options;
    }

    var parsed = ConfigurationOptions.Parse(connectionString, true);
    parsed.AbortOnConnectFail = false;
    parsed.ConnectRetry = 5;
    parsed.ReconnectRetryPolicy = new ExponentialRetry(5_000);
    return parsed;
}

// ─── Services ────────────────────────────────────────────────────────────────

builder.Services.AddHttpClient();
builder.Services.AddSingleton<WorkspaceValidator>();
builder.Services.AddSingleton<ServiceRegistry>();
builder.Services.AddSingleton<TerminalCollaborationRegistry>();

// SignalR with MessagePack protocol
builder.Services.AddSignalR(options =>
{
    // Allow large messages for screenshot transfer (up to 10MB)
    options.MaximumReceiveMessageSize = 10 * 1024 * 1024;
})
    .AddMessagePackProtocol();

// Register RedisSubscriber always (it handles null redis gracefully)
builder.Services.AddSingleton<RedisSubscriber>();

// Redis backplane disabled for single-instance deployment
// Custom RedisSubscriber handles cross-service communication instead
if (redisEnabled)
{
    builder.Services.AddHostedService<RedisSubscriber>(sp => sp.GetRequiredService<RedisSubscriber>());

    // Redis for terminal output buffering
    var redis = ConnectionMultiplexer.Connect(BuildRedisOptions(redisConnectionString));
    builder.Services.AddSingleton<IConnectionMultiplexer>(redis);
}

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(frontendUrl)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Health checks
builder.Services.AddHealthChecks();

// ─── App ─────────────────────────────────────────────────────────────────────

var app = builder.Build();

app.UseCors();

app.MapHealthChecks("/health");

// Map hub endpoints
app.MapHub<TerminalHub>("/hubs/terminal");
app.MapHub<CanvasHub>("/hubs/canvas");
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<FileHub>("/hubs/file");

app.Run();

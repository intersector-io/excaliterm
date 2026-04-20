using StackExchange.Redis;
using TerminalProxy.Hub.Auth;
using TerminalProxy.Hub.Hubs;
using TerminalProxy.Hub.Services;

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

// ─── Services ────────────────────────────────────────────────────────────────

builder.Services.AddHttpClient();
builder.Services.AddSingleton<WorkspaceValidator>();
builder.Services.AddSingleton<ServiceRegistry>();
builder.Services.AddSingleton<TerminalCollaborationRegistry>();

// SignalR with MessagePack protocol
builder.Services.AddSignalR()
    .AddMessagePackProtocol();

// Register RedisSubscriber always (it handles null redis gracefully)
builder.Services.AddSingleton<RedisSubscriber>();

// Redis backplane disabled for single-instance deployment
// Custom RedisSubscriber handles cross-service communication instead
if (redisEnabled)
{
    builder.Services.AddHostedService<RedisSubscriber>(sp => sp.GetRequiredService<RedisSubscriber>());

    // Redis for terminal output buffering
    var redis = ConnectionMultiplexer.Connect(redisConnectionString);
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

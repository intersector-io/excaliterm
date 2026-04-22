using StackExchange.Redis;

namespace Excaliterm.Hub.Services;

public static class RedisOptionsBuilder
{
    public static ConfigurationOptions Build(string connectionString)
    {
        // Normalize: add scheme if missing but has user:pass@host format
        if (!connectionString.StartsWith("redis://") && !connectionString.StartsWith("rediss://")
            && connectionString.Contains('@'))
        {
            connectionString = "redis://" + connectionString;
        }

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
}

# Windows Service Guide

The Terminal Proxy Windows Service is a .NET 8 Worker Service that manages PowerShell processes using the Windows ConPTY (Pseudo Console) API. It connects to the backend via WebSocket and handles terminal lifecycle operations.

## Requirements

- **Windows 10 version 1809 (build 17763)** or later, or **Windows 11**
- **.NET 8 Runtime** (or SDK for building from source)
- Network access to the backend WebSocket endpoint

ConPTY (Pseudo Console) is the Windows API that provides a real terminal experience. It was introduced in Windows 10 1809 and is required for this service to function.

## Building

### Debug Build

```bash
cd apps/windows-service/TerminalProxy.Service
dotnet build
```

Output: `bin/Debug/net8.0-windows/`

### Release Build

```bash
dotnet build -c Release
```

### Self-Contained Publish

For deployment to machines without the .NET runtime:

```bash
dotnet publish -c Release -r win-x64 --self-contained true -o ./publish
```

This produces a standalone executable in `./publish/` that includes the .NET runtime.

## Configuration

Edit `appsettings.json` (or `appsettings.Production.json` for production overrides):

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  },
  "ServiceOptions": {
    "BackendWsUrl": "ws://localhost:3001",
    "ApiKey": "your-service-api-key-here",
    "ServiceId": "machine-01",
    "ReconnectDelayMs": 3000,
    "MaxReconnectDelayMs": 30000
  }
}
```

| Option              | Description                                                  | Default |
|---------------------|--------------------------------------------------------------|---------|
| `BackendWsUrl`      | WebSocket URL of the backend (connects to `/ws/service`)     | `ws://localhost:3001` |
| `ApiKey`            | Shared secret matching the backend's `SERVICE_API_KEY`       | (empty) |
| `ServiceId`         | Identifier for this service instance (logged on connect)     | (empty) |
| `ReconnectDelayMs`  | Initial reconnection delay in milliseconds                   | 3000    |
| `MaxReconnectDelayMs` | Maximum reconnection delay (exponential backoff cap)       | 30000   |

## Running for Development

Run as a console application (not as a Windows Service):

```bash
cd apps/windows-service/TerminalProxy.Service
dotnet run
```

This is the preferred way to run during development. The service will connect to the backend and log output to the console.

## Installing as a Windows Service

### 1. Build or Publish

```bash
cd apps/windows-service/TerminalProxy.Service
dotnet publish -c Release -r win-x64 --self-contained true -o C:\Services\TerminalProxy
```

### 2. Create the Service

Open an **elevated** (Administrator) command prompt or PowerShell:

```cmd
sc.exe create TerminalProxy binPath="C:\Services\TerminalProxy\TerminalProxy.Service.exe" start=auto displayname="Terminal Proxy Service"
```

| Parameter     | Value                                             |
|---------------|---------------------------------------------------|
| `binPath`     | Full path to the published executable             |
| `start=auto`  | Starts automatically with Windows                 |
| `displayname` | Friendly name shown in Services management console |

### 3. Configure the Service Account

By default, the service runs as `Local System`. To use a specific account:

```cmd
sc.exe config TerminalProxy obj="DOMAIN\User" password="password"
```

### 4. Start the Service

```cmd
sc.exe start TerminalProxy
```

### 5. Verify

```cmd
sc.exe query TerminalProxy
```

Expected output should show `STATE: RUNNING`.

## Stopping the Service

```cmd
sc.exe stop TerminalProxy
```

## Uninstalling the Service

```cmd
sc.exe stop TerminalProxy
sc.exe delete TerminalProxy
```

Then remove the published files:

```cmd
rmdir /s /q C:\Services\TerminalProxy
```

## Architecture

The service uses .NET's generic host with dependency injection:

```
Program.cs           # Host builder, DI registration
Worker.cs            # BackgroundService - main lifecycle
├── BackendConnection  # WebSocket client, reconnection logic
├── MessageHandler     # Deserializes and dispatches incoming messages
├── MessageSerializer  # JSON serialization for the WS protocol
└── TerminalManager    # Creates/destroys ConPTY terminal processes
    └── TerminalProcess  # Individual ConPTY process wrapper
        └── PseudoConsole  # Windows ConPTY API interop
```

### Key Classes

| Class               | Responsibility                                                |
|---------------------|---------------------------------------------------------------|
| `Worker`            | Wires up event handlers and starts the connection loop        |
| `BackendConnection` | Manages WebSocket lifecycle, sends messages, auto-reconnects  |
| `MessageHandler`    | Parses incoming messages and calls TerminalManager methods    |
| `MessageSerializer` | Serializes/deserializes JSON message envelopes                |
| `TerminalManager`   | Thread-safe dictionary of active TerminalProcess instances    |
| `TerminalProcess`   | Wraps a single ConPTY process (start, write, resize, dispose) |
| `PseudoConsole`     | P/Invoke wrapper for Windows ConPTY API calls                 |

## Troubleshooting

### Service does not start

1. **Check the Event Viewer**: Open Event Viewer > Windows Logs > Application. Look for entries from `TerminalProxyService`.

2. **Run as console first**: Stop the service and run the executable directly to see console output:
   ```cmd
   C:\Services\TerminalProxy\TerminalProxy.Service.exe
   ```

3. **Verify .NET runtime**: If not self-contained, ensure .NET 8 runtime is installed:
   ```cmd
   dotnet --list-runtimes
   ```

### Service starts but cannot connect to backend

1. **Check `BackendWsUrl`** in `appsettings.json` -- ensure the URL is correct and includes the port.

2. **Verify backend is running**: The backend must be running and listening before the service connects. The service will retry with exponential backoff.

3. **Check API key**: The `ApiKey` in `appsettings.json` must match `SERVICE_API_KEY` in the backend's `.env`. Mismatched keys cause a `4003` close code.

4. **Firewall**: Ensure the backend port (default 3001) is accessible from the machine running the service.

5. **Check logs**: In development, logs print to console. When running as a Windows Service, check Event Viewer.

### Terminals fail to create

1. **ConPTY support**: Verify you are running Windows 10 1809+ or Windows 11:
   ```cmd
   winver
   ```

2. **PowerShell availability**: The service starts `powershell.exe` (or `pwsh.exe`). Ensure it is available on the system PATH.

3. **Permissions**: The service account must have permission to create processes. `Local System` has sufficient permissions by default.

### High memory usage

Each terminal process consumes memory. Monitor the active terminal count. Terminals that are no longer in use should be destroyed via the API or UI to free resources.

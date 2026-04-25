# Troubleshooting

Common errors when running the `excaliterm` CLI, with the most likely causes
listed first. If none of these solve your issue, please
[open a GitHub issue](https://github.com/intersector-io/excaliterm/issues) with
the full CLI output.

---

## Shell self-test failed

Error looks like:

```
[terminal-agent] Shell self-test failed: cannot spawn "/bin/zsh" in cwd "/Users/<name>": posix_spawnp failed.
[terminal-agent] Refusing to start. Fix the shell/cwd above or pass --shell <path>.
```

The agent runs a one-off PTY spawn at startup so it fails fast instead of
breaking every terminal you create later. The spawn can fail for several
reasons — work through them in order:

### 1. node-pty native binary mismatch (most common on Apple Silicon)

The prebuilt `node-pty` binary doesn't match your CPU architecture. Common
when Node was installed under Rosetta on an arm64 Mac (or vice versa).

Check:

```bash
node -e 'console.log(process.arch, process.platform)'
uname -m
```

If `process.arch` is `x64` but `uname -m` reports `arm64` (or the other way
round), reinstall under the native arch:

```bash
arch -arm64 npm i -g excaliterm
# or with pnpm / yarn equivalents
```

### 2. cwd doesn't exist or isn't accessible

The agent defaults to `$HOME`. If `$HOME` points to a directory that doesn't
exist on this machine (stale dotfiles copied from another laptop, mounted
volume not present, etc.), the spawn fails.

Check:

```bash
echo $HOME
ls -ld "$HOME"
```

Workaround — pass an explicit cwd:

```bash
excaliterm --cwd "$(pwd)" ...
```

### 3. Shell not executable

Rare, but possible on stripped/minimal images.

Check:

```bash
ls -l /bin/zsh
/bin/zsh -c 'echo ok'
```

Workaround — use a different shell:

```bash
excaliterm --shell /bin/bash ...
```

### 4. macOS quarantine / MDM blocking spawn

If you downloaded the binary directly (not via npm), Gatekeeper may have
quarantined it. Corporate MDM policies can also block process spawn from
certain locations.

Check & fix:

```bash
xattr "$(which excaliterm)"
xattr -d com.apple.quarantine "$(which excaliterm)"   # if quarantine is present
```

If running from a sandboxed location like `~/Downloads`, move it elsewhere
(`/usr/local/bin`, `~/bin`).

---

## Cannot reach hub

Error looks like:

```
[terminal-agent] Failed to connect: getaddrinfo ENOTFOUND hub.excaliterm.com
```

or a TLS / 502 / timeout.

Likely causes, in order:

1. **DNS / network** — `curl -I https://hub.excaliterm.com` from the same
   machine. If that fails, the issue is local network or DNS.
2. **Corporate proxy blocking WebSockets** — SignalR needs a working WebSocket
   upgrade. If your network only allows HTTP, set
   `HTTPS_PROXY` / `HTTP_PROXY` env vars and ensure the proxy supports
   WebSockets.
3. **Self-hosted hub URL wrong** — double-check `--hub-url` matches your
   deployment. The path should be the hub origin, no trailing `/hub` or
   similar.

---

## 401 Unauthorized on connect

Error looks like:

```
[terminal-agent] Hub connection rejected: 401
```

Likely causes:

1. **API key revoked or wrong** — copy the key fresh from the workspace UI.
   The key is shown once at workspace creation; if you've lost it, create a
   new workspace.
2. **API key belongs to a different workspace** — `--workspace-id` and
   `--api-key` must be from the same workspace. Cross-workspace keys are
   rejected.
3. **Clock skew** — if the host clock is off by more than a few minutes,
   signed requests can fail. Sync NTP.

---

## Workspace not found

Error looks like:

```
[terminal-agent] Workspace "<id>" does not exist
```

The workspace was either never created on this hub, or was deleted. Open
the workspace URL (`https://<hub>/w/<workspace-id>`) in a browser to
confirm. If it 404s, create a new workspace.

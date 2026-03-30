# local-env-mcp

A stateless, Dockerized [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes your local machine — filesystem, git, shell, network, and system — to any MCP-compatible LLM client over HTTP.

Built on the [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) with a [Streamable HTTP transport](https://modelcontextprotocol.io/docs/concepts/transports#streamable-http), Express, and Zod for runtime schema validation.

---

## Table of Contents

- [local-env-mcp](#local-env-mcp)
  - [Table of Contents](#table-of-contents)
  - [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [Transport \& Session Model](#transport--session-model)
  - [Tool Reference](#tool-reference)
    - [📁 Filesystem (`src/tools/filesystem.js`)](#-filesystem-srctoolsfilesystemjs)
    - [🌿 Git (`src/tools/git.js`)](#-git-srctoolsgitjs)
    - [🌐 Network (`src/tools/network.js`)](#-network-srctoolsnetworkjs)
    - [💻 Shell (`src/tools/shell.js`)](#-shell-srctoolsshelljs)
    - [🖥️ System (`src/tools/system.js`)](#️-system-srctoolssystemjs)
  - [Environment Variables](#environment-variables)
  - [Running Locally (Node.js)](#running-locally-nodejs)
  - [Running with Docker Compose](#running-with-docker-compose)
  - [Connecting Clients](#connecting-clients)
    - [Claude.ai](#claudeai)
    - [Cursor](#cursor)
    - [Anthropic API (direct)](#anthropic-api-direct)
  - [Authentication](#authentication)
  - [Security Model](#security-model)
  - [Extending with New Tools](#extending-with-new-tools)
  - [Health Check](#health-check)
  - [ngrok Dashboard](#ngrok-dashboard)

---

## Architecture

```
LLM Client (Claude / Cursor / API)
        │  HTTPS POST /mcp
        ▼
  [ngrok tunnel]
        │
        ▼
  Express HTTP Server  (:3000)
        │
        ├── POST /mcp  → createMcpServer() + StreamableHTTPServerTransport
        ├── GET  /mcp  → resume existing session (by mcp-session-id header)
        ├── DELETE /mcp → close session
        └── GET  /health → uptime + FS_ROOT
               │
               ▼
        McpServer (per-request instance)
               │
        ┌──────┼──────────────────────┐
        ▼      ▼      ▼       ▼       ▼
   filesystem  git  network  shell  system
    (9 tools) (11) (8 tools) (9)   (8 tools)
```

Each `POST /mcp` request spins up a **fresh `McpServer` instance** with a new `StreamableHTTPServerTransport`. Sessions are tracked in a `Map<sessionId, { server, transport }>` and cleaned up on `transport.onclose`.

---

## Project Structure

```
local-mcp/
├── src/
│   ├── server.js               # Express app, session management, MCP transport wiring
│   ├── middleware/
│   │   └── auth.js             # X-MCP-Token header validation middleware
│   └── tools/
│       ├── filesystem.js       # File I/O, directory ops, glob search
│       ├── git.js              # simple-git wrapper — status, diff, log, branch, etc.
│       ├── network.js          # HTTP requests, ping, DNS, port scan, download
│       ├── shell.js            # Command execution, background processes, env, ps
│       └── system.js           # Disk, clipboard, notifications, screenshot, packages
├── Dockerfile                  # node:20-slim + system tools (git, curl, nc, dig, ...)
├── docker-compose.yml          # MCP service + optional ngrok sidecar
└── package.json
```

---

## Transport & Session Model

This server uses the **Streamable HTTP** transport from the MCP SDK (`StreamableHTTPServerTransport`), which supports both single-request (stateless) and session-based (stateful) interactions.

| Route | Purpose |
|---|---|
| `POST /mcp` | Initiate a new MCP session or handle a stateless request |
| `GET /mcp` | Stream responses back for an existing session (SSE) |
| `DELETE /mcp` | Tear down an existing session |

The `mcp-session-id` request header is used to correlate `GET` and `DELETE` calls to an active session. The server uses `sessionIdGenerator: undefined` (SDK default) which auto-generates UUIDs.

---

## Tool Reference

### 📁 Filesystem (`src/tools/filesystem.js`)

All paths are resolved relative to `FS_ROOT` and validated against path traversal.

| Tool | Parameters | Description |
|---|---|---|
| `read_file` | `path: string` | Read file contents. Returns UTF-8 text or base64 for binary files (detected via MIME type). |
| `write_file` | `path`, `content`, `append?: bool` | Write or append text to a file. Creates parent directories automatically. |
| `list_dir` | `path`, `recursive?: bool`, `show_hidden?: bool` | List directory contents with size metadata. |
| `make_dir` | `path: string` | Create a directory and all missing parents (`mkdir -p`). |
| `delete_path` | `path`, `recursive?: bool` | Delete a file or directory. |
| `copy_path` | `src`, `dest` | Copy file or directory (recursive). |
| `move_path` | `src`, `dest` | Move or rename a file or directory. |
| `search_files` | `base_path`, `pattern?`, `content_search?`, `max_results?` | Glob pattern search and/or full-text search inside files. Ignores `node_modules` and `.git`. |
| `file_info` | `path: string` | Returns path, type, size, MIME type, timestamps, and octal permissions. |

**Binary detection** uses `mime-types`. Files whose MIME type does not start with `text/` and does not include `json`, `xml`, or `javascript` are treated as binary and returned as base64.

---

### 🌿 Git (`src/tools/git.js`)

Wraps [`simple-git`](https://github.com/steveukx/git-js). All tools take a `repo` parameter — a path to a git repository relative to `FS_ROOT`.

| Tool | Key Parameters | Description |
|---|---|---|
| `git_status` | `repo` | Branch, ahead/behind, staged, modified, untracked, deleted, conflicts. |
| `git_diff` | `repo`, `staged?`, `file?`, `from?`, `to?` | Working tree diff, staged diff, or between two refs. |
| `git_log` | `repo`, `max_count?`, `branch?`, `file?` | Commit history — hash, date, author, message. |
| `git_branch` | `repo`, `action`, `name?`, `remote?` | List, create, delete, or checkout branches. |
| `git_add` | `repo`, `files?` | Stage specific files or all changes (`-A`). |
| `git_commit` | `repo`, `message`, `author_name?`, `author_email?` | Commit with optional author override. |
| `git_push` | `repo`, `remote?`, `branch?`, `force?` | Push to remote. |
| `git_pull` | `repo`, `remote?`, `branch?`, `rebase?` | Pull from remote with optional rebase. |
| `git_clone` | `url`, `dest`, `depth?` | Clone a repository to a local path. |
| `git_stash` | `repo`, `action`, `message?` | Save, pop, list, or drop stash. |
| `git_show` | `repo`, `commit?` | Show commit content and `--stat` diff. |

---

### 🌐 Network (`src/tools/network.js`)

| Tool | Key Parameters | Description |
|---|---|---|
| `http_request` | `url`, `method?`, `headers?`, `body?`, `timeout_ms?`, `follow_redirects?` | Full HTTP client. Returns status, headers, and body (truncated at 8000 chars). |
| `ping` | `host`, `count?` | ICMP ping via system `ping`. |
| `dns_lookup` | `host`, `type?` | DNS resolution via `dig` / `nslookup`. Types: A, AAAA, MX, TXT, CNAME, NS, SOA, ALL. |
| `port_scan` | `host`, `ports: number[]`, `timeout_ms?` | TCP port check via `nc -z`. Returns OPEN / CLOSED per port. |
| `whois` | `query` | WHOIS lookup for a domain or IP. |
| `traceroute` | `host` | Network path trace (max 20 hops on Linux). |
| `download_file` | `url`, `dest` | Download a file from a URL to `FS_ROOT`-relative path. |
| `check_connectivity` | _(none)_ | Checks latency to `1.1.1.1`, `google.com`, and `api.github.com`. |

`http_request` uses [`node-fetch`](https://github.com/node-fetch/node-fetch) with an `AbortController` for timeout enforcement.

---

### 💻 Shell (`src/tools/shell.js`)

| Tool | Key Parameters | Description |
|---|---|---|
| `run_command` | `command`, `cwd?`, `timeout_ms?`, `env?` | Execute a shell command. Returns `STDOUT` and `STDERR` separately. Max buffer: 10 MB. |
| `spawn_process` | `command`, `args?`, `cwd?`, `env?` | Spawn a background process. Returns a numeric process ID. Logs stdout/stderr in memory. |
| `list_processes` | _(none)_ | List all active background processes spawned by `spawn_process`. |
| `get_process_logs` | `process_id`, `last_n?` | Tail the stdout/stderr log buffer of a background process. |
| `kill_process` | `process_id?`, `pid?`, `signal?` | Kill by spawn ID or system PID. Signals: SIGTERM, SIGKILL, SIGHUP. |
| `system_info` | _(none)_ | OS, hostname, uptime, CPU, memory, load average, Node version, disk (`df -h`). |
| `get_env` | `filter?`, `key?` | Read environment variables. Redacts keys matching `secret\|token\|password\|key\|api`. |
| `which` | `command` | Resolve binary path via `which` / `where`. |
| `ps` | `filter?`, `full?` | List system processes. Full mode uses `ps aux`; default sorts by `%cpu`. |

Background processes are stored in a module-level `Map` and persist for the lifetime of the server process.

---

### 🖥️ System (`src/tools/system.js`)

| Tool | Key Parameters | Description |
|---|---|---|
| `cron_list` | _(none)_ | Output of `crontab -l` for the current user. |
| `disk_usage` | `path?`, `depth?` | `du -h --max-depth=N`, sorted by size. |
| `open` | `target` | Open a file or URL with the system default app (`open` / `xdg-open` / `start`). |
| `notify` | `title`, `message` | Desktop notification via `osascript` (macOS), `msg` (Windows), or `notify-send` (Linux). |
| `clipboard_write` | `text` | Write text to system clipboard (`pbcopy` / `clip` / `xclip`). |
| `clipboard_read` | _(none)_ | Read text from system clipboard. |
| `screenshot` | `output_path`, `delay_secs?` | Capture screen to file (`screencapture` / `scrot` / `import`). |
| `list_installed` | `manager`, `filter?` | List packages for `npm`, `pip`, `brew`, `apt`, or `cargo`. |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port the Express server listens on |
| `FS_ROOT` | No | `/host-home` | Root directory for all filesystem operations. All paths are validated to stay within this. |
| `MCP_AUTH_TOKEN` | **Yes (prod)** | _(none)_ | Bearer token for `X-MCP-Token` header validation. Omitting it in `production` causes a 500. |
| `NODE_ENV` | No | _(unset)_ | Set to `production` to enforce `MCP_AUTH_TOKEN`. In dev mode, missing token only warns. |
| `NGROK_AUTHTOKEN` | No | _(none)_ | Required only if using the ngrok sidecar in `docker-compose.yml`. |

---

## Running Locally (Node.js)

**Requirements:** Node.js ≥ 20

```bash
git clone <repo-url>
cd local-mcp
npm install

export MCP_AUTH_TOKEN=your-secret-token
export FS_ROOT=$HOME   # or any directory you want to expose

npm start
# or for auto-reload during development:
npm run dev
```

The server starts on `http://localhost:3000`.

To expose it publicly via ngrok:

```bash
ngrok http 3000
```

---

## Running with Docker Compose

```bash
# Copy and fill in environment variables
cp .env.example .env
# Set MCP_AUTH_TOKEN and NGROK_AUTHTOKEN in .env

# Build and start (MCP server + ngrok tunnel)
docker compose up -d --build

# Get the public ngrok URL
docker compose logs ngrok | grep "url="

# View MCP server logs
docker compose logs -f mcp

# Stop
docker compose down
```

The Docker image is based on `node:20-slim` and includes: `git`, `curl`, `wget`, `netcat-openbsd`, `dnsutils`, `whois`, `traceroute`, `iputils-ping`, and `procps`.

Your `$HOME` directory is bind-mounted to `/host-home` inside the container (configured in `docker-compose.yml`). The server runs as a non-root `mcpuser`.

---

## Connecting Clients

### Claude.ai

**Settings → Integrations → Add MCP Server**

```
URL:    https://<your-ngrok-url>/mcp
Header: X-MCP-Token: <your-token>
```

### Cursor

Create or edit `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "local-env": {
      "url": "https://<your-ngrok-url>/mcp",
      "headers": {
        "X-MCP-Token": "<your-token>"
      }
    }
  }
}
```

### Anthropic API (direct)

```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "mcp-client-2025-04-04",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    mcp_servers: [{
      type: "url",
      url: "https://<your-ngrok-url>/mcp",
      name: "local-env",
      authorization_token: "<your-token>",
    }],
    messages: [{ role: "user", content: "List my home directory" }]
  })
});
```

---

## Authentication

Authentication is handled by `src/middleware/auth.js`. Every request must include:

```
X-MCP-Token: <MCP_AUTH_TOKEN>
```

Behaviour by environment:

| Condition | Result |
|---|---|
| `MCP_AUTH_TOKEN` set, correct token provided | Request passes through |
| `MCP_AUTH_TOKEN` set, wrong/missing token | `401 Unauthorized` |
| `MCP_AUTH_TOKEN` not set, `NODE_ENV=production` | `500 Server misconfiguration` |
| `MCP_AUTH_TOKEN` not set, dev mode | Warning logged, request passes through |

> The middleware is imported in `server.js` but currently commented out at the `app.use()` call. Uncomment `app.use(authMiddleware)` in `server.js` to activate it.

---

## Security Model

| Concern | Mitigation |
|---|---|
| Path traversal | `safePath()` in `filesystem.js` resolves and validates every path against `FS_ROOT` before any I/O |
| Secret leakage | `get_env` redacts any env var whose key matches `/secret\|token\|password\|key\|api/i` |
| Unauthenticated access | `X-MCP-Token` header required (enforced in production) |
| Container privilege | Docker container runs as non-root `mcpuser` |
| Filesystem scope | `FS_ROOT` bind-mount limits what the container can reach on the host |

**Do not expose this server publicly without setting `MCP_AUTH_TOKEN`.**

---

## Extending with New Tools

1. Create `src/tools/your_module.js`:

```javascript
import { z } from "zod";

export function registerYourTools(server) {
  server.tool(
    "tool_name",
    "Description shown to the LLM when selecting tools",
    {
      param_one: z.string().describe("What this parameter does"),
      param_two: z.number().optional().default(10),
    },
    async ({ param_one, param_two }) => {
      const result = doSomething(param_one, param_two);
      return { content: [{ type: "text", text: String(result) }] };
    }
  );
}
```

2. Import and register in `src/server.js`:

```javascript
import { registerYourTools } from "./tools/your_module.js";

function createMcpServer() {
  const server = new McpServer({ name: "local-env-mcp", version: "1.0.0" });
  // ... existing registrations
  registerYourTools(server);
  return server;
}
```

Tool schemas use [Zod](https://zod.dev/) and are automatically surfaced to MCP clients for tool discovery.

---

## Health Check

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "uptime": "42",
  "fs_root": "/host-home"
}
```

The Docker Compose healthcheck polls this endpoint every 30 seconds (`curl -f http://localhost:3000/health`).

---

## ngrok Dashboard

When the ngrok sidecar is running, the inspection UI is available at:

```
http://localhost:4040
```

Use it to inspect request/response payloads, replay requests, and monitor active tunnels.

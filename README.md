# local-env-mcp

A stateless, Dockerized [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes your local machine — filesystem, git, shell, network, and system — to any MCP-compatible LLM client over HTTP.

Built on the [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) with a [Streamable HTTP transport](https://modelcontextprotocol.io/docs/concepts/transports#streamable-http), Express, and Zod for runtime schema validation.

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd local-mcp
npm install

# 2. Start the server with Docker
docker compose up -d --build

# 3. Expose via ngrok (in a separate terminal)
ngrok http 3000

# 4. Copy the ngrok URL and add to Claude.ai
# Settings → Integrations → Add MCP Server
# URL: https://your-ngrok-url.ngrok-free.app/mcp
```

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
        ├── POST /mcp    → Create new McpServer + Transport (stateless)
        ├── GET  /mcp    → Resume session (optional, by mcp-session-id)
        ├── DELETE /mcp  → Close session
        └── GET  /health → Server status
               │
               ▼
        McpServer (fresh instance per request)
               │
        ┌──────┼──────────────────────┐
        ▼      ▼      ▼       ▼       ▼
   filesystem  git  network  shell  system
    (9 tools) (11) (8 tools) (9)   (8 tools)
```

**Stateless Mode**: Each POST request creates a fresh McpServer instance. No initialization handshake required — tools can be called immediately (compatible with Claude.ai).

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

This server uses **Streamable HTTP** transport in **stateless mode** (`sessionIdGenerator: undefined`).

| Route | Purpose |
|---|---|
| `POST /mcp` | Handle MCP requests (tools/list, tools/call, etc.) — creates fresh server per request |
| `GET /mcp` | Stream responses for session-based clients (optional) |
| `DELETE /mcp` | Close an active session (optional) |

Stateless mode means:
- No `initialize` handshake required
- Each request is independent
- Compatible with Claude.ai's direct tool calling

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
# Start the MCP server
docker compose up -d --build

# Check logs
docker compose logs -f mcp

# Expose via ngrok (separate terminal)
ngrok http 3000

# Stop
docker compose down
```

The Docker image is based on `node:20-slim` and includes: `git`, `curl`, `wget`, `netcat-openbsd`, `dnsutils`, `whois`, `traceroute`, `iputils-ping`, and `procps`.

Your `$HOME` directory is bind-mounted to `/host-home` inside the container. The server runs as non-root `mcpuser`.

---

## Connecting Clients

### Claude.ai

**Settings → Connectors → Add MCP Server**

```
URL: https://<your-ngrok-url>/mcp
```

No auth token needed in testing mode.

### Cursor

Create or edit `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "local-env": {
      "url": "https://<your-ngrok-url>/mcp"
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
    }],
    messages: [{ role: "user", content: "List my home directory" }]
  })
});
```

---

## Authentication

Authentication is **disabled by default** for testing. To enable:

1. Uncomment the auth middleware in `src/server.js`:
```javascript
import { authMiddleware } from "./middleware/auth.js";
app.use(authMiddleware);
```

2. Set `MCP_AUTH_TOKEN` in your environment or `.env` file

3. Include the token in client requests:
```
X-MCP-Token: <your-token>
```

| Condition | Result |
|---|---|
| `MCP_AUTH_TOKEN` set, correct token | ✅ Request passes |
| `MCP_AUTH_TOKEN` set, wrong/missing token | ❌ 401 Unauthorized |
| `MCP_AUTH_TOKEN` not set, `NODE_ENV=production` | ⚠️ 500 Server misconfiguration |
| `MCP_AUTH_TOKEN` not set, dev mode | ⚠️ Warning logged, request passes |

---

## Security Model

| Concern | Mitigation |
|---|---|
| Path traversal | `safePath()` validates all paths against `FS_ROOT` |
| Secret leakage | `get_env` redacts keys matching `/secret\|token\|password\|key\|api/i` |
| Unauthenticated access | Optional `X-MCP-Token` header (disabled by default for testing) |
| Container privilege | Runs as non-root `mcpuser` |
| Filesystem scope | `FS_ROOT` bind-mount limits container access |

**⚠️ For production use, enable authentication and use a strong token.**

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

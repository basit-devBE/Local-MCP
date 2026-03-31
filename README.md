# local-env-mcp

A stateless, Dockerized [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server built with TypeScript. It exposes your local machine — filesystem, git, shell, network, databases, and system — to any MCP-compatible LLM client over HTTP.

Built natively in TypeScript on the [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) utilizing Express, Zod schemas, and a fully decoupled, layered architecture.

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd local-mcp
npm install

# 2. Build the TypeScript source
npm run build

# 3. Start the server (runs on port 3000 by default)
npm start

# OR Start with Docker (multi-stage build)
docker compose up -d --build

# 4. Expose via ngrok (in a separate terminal)
ngrok http 3001

# 5. Copy the ngrok URL and add to Claude.ai
# Settings → Integrations → Add MCP Server
# URL: https://your-ngrok-url.ngrok-free.app/mcp
```

---

## Table of Contents

- [local-env-mcp](#local-env-mcp)
  - [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [Transport \& Session Model](#transport--session-model)
  - [Tool Reference](#tool-reference)
    - [📁 Filesystem](#-filesystem)
    - [🌿 Git](#-git)
    - [🌐 Network](#-network)
    - [💻 Shell](#-shell)
    - [🖥️ System](#️-system)
    - [🐘 Postgres](#-postgres)
  - [Environment Variables](#environment-variables)
  - [Extending with New Tools](#extending-with-new-tools)
  - [Security Model](#security-model)

---

## Architecture

```
LLM Client (Claude / Cursor / API)
        │  HTTPS POST /mcp
        ▼
   Express Routing Layer (src/app.ts)
        │
        ├── GET  /health → System Checks
        ├── POST /mcp    → Create Server Session
        ├── GET  /mcp    → Resume Session
        └── DELETE /mcp  → Purge Session
               │
               ▼
   Layered Tool Registry (src/tools/registry.ts)
               │
 ┌─────────┬───┴─────┬─────────┬─────────┬─────────┐
 ▼         ▼         ▼         ▼         ▼         ▼
 FS       Git      Network   Shell     System    Postgres
(9)      (11)       (8)       (9)       (8)       (3)
```

**Stateless Mode**: Each POST request spins up a fresh McpServer instance dynamically managed by a singleton Session Manager.

---

## Project Structure

Migrated from legacy monolithic JS, the project now follows a strictly typed layered framework:

```
local-mcp/
├── src/
│   ├── server.ts               # Listener & bootstrap
│   ├── app.ts                  # Express routing & middleware wiring
│   ├── config.ts               # Zod-validated env loader (.env handled via dotenv)
│   ├── logger.ts               # Winston configuration
│   ├── routes/                 # Separated Controllers (health.ts, mcp.ts)
│   ├── services/               # Core Logic (processManager, sessionManager)
│   ├── types/                  # Shared TS definitions
│   └── tools/                  # All 48 MCP Tools separated by domain
│       ├── filesystem/         
│       ├── git/                
│       ├── network/            
│       ├── postgres/           # Dynamic Database capabilities
│       ├── shell/              
│       ├── system/             
│       └── registry.ts         # Injects toolsets into active MCP Sessions
```

---

## Transport & Session Model

Uses the **Streamable HTTP** transport. 

| Route | Purpose |
|---|---|
| `POST /mcp` | Initiates tool requests (tools/list, tools/call) — hooks into new or cached session. |
| `GET /mcp` | Streams Server-Sent Events (SSE) for continuous clients. |
| `DELETE /mcp` | Gracefully terminate an active server. |

---

## Tool Reference

Currently bundling **48 Native Tools** mapped through specific modules.

### 📁 Filesystem
*(All paths resolved relative to `FS_ROOT` protecting against directory traversal)*
- `read_file`, `write_file`, `list_dir`, `make_dir`, `delete_path`, `copy_path`, `move_path`, `search_files`, `file_info`

### 🌿 Git
*(Powered by simple-git, targets directories relative to `FS_ROOT`)*
- `git_status`, `git_diff`, `git_log`, `git_branch`, `git_add`, `git_commit`, `git_push`, `git_pull`, `git_clone`, `git_stash`, `git_show`

### 🌐 Network
- `http_request`, `ping`, `dns_lookup`, `port_scan`, `whois`, `traceroute`, `download_file`, `check_connectivity`

### 💻 Shell
*(Managed by the injected `ProcessManager` service isolating spawn logs in memory)*
- `run_command`, `spawn_process`, `list_processes`, `get_process_logs`, `kill_process`, `system_info`, `get_env`, `which`, `ps`

### 🖥️ System
- `cron_list`, `disk_usage`, `open`, `notify`, `clipboard_write`, `clipboard_read`, `screenshot`, `list_installed`

### 🐘 Postgres
*(Connects dynamically on-the-fly rather than hardcoded global connections)*
- `pg_query`: Execute parameterized raw SQL queries directly. 
- `pg_list_tables`: Enumerate all active tables ignoring system schemas.
- `pg_describe_table`: Interrogate type formats, nullability, and default requirements for a target schema table.

*Note: The Postgres tools require you to provide a `connectionString` argument directly through the LLM interface, keeping your server completely credential-less by design.*

---

## Environment Variables

Handled seamlessly using `dotenv`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port the Express server binds to. |
| `FS_ROOT` | No | `/host-home` | Root directory for File operations. Path constraints enforce this border. |
| `MCP_AUTH_TOKEN` | **Yes (prod)** | _(none)_ | Bearer auth token for `X-MCP-Token`. Omitting heavily warns during `dev` mode. |
| `NODE_ENV` | No | `development` | Setting to `production` enforces Token Auth checks. |

---

## Extending with New Tools

Adding tools is significantly easier with the Modular Architecture:

1. Create a strictly-typed configuration inside your target domain layer (e.g. `src/tools/custom/myTool.ts`):
```typescript
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";

export const myCustomTool: ToolDefinition = {
  name: "custom_tool",
  description: "Does something specific",
  schema: {
    target: z.string().describe("What to target"),
  },
  handler: async ({ target }) => {
    return ok(`Executed logic on ${target}`);
  }
};
```
2. Import and append your tool array to `registerAllTools` in `src/tools/registry.ts`. 

---

## Security Model

| Concern | Mitigation |
|---|---|
| Path traversal | `safePath()` heavily anchors against `FS_ROOT` bounds. |
| Secret leakage | `get_env` redacts items masking standard keys (secrets/passwords/apis). |
| Docker Isolation | Runs natively as unescalated `mcpuser` relying on safe Mount Points. |
| DB Access | Handled dynamically avoiding persistent `env` leaks in logs. |

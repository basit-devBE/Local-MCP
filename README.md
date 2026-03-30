# local-env-mcp

A full-featured, Dockerized MCP server that gives LLMs (Claude, GPT-4o, Cursor, etc.) 
access to your local machine over a secure ngrok tunnel.

## Tools included

| Group | Tools |
|---|---|
| 📁 Filesystem | `read_file`, `write_file`, `list_dir`, `make_dir`, `delete_path`, `copy_path`, `move_path`, `search_files`, `file_info` |
| 🌿 Git | `git_status`, `git_diff`, `git_log`, `git_branch`, `git_add`, `git_commit`, `git_push`, `git_pull`, `git_clone`, `git_stash`, `git_show` |
| 🌐 Network | `http_request`, `ping`, `dns_lookup`, `port_scan`, `whois`, `traceroute`, `download_file`, `check_connectivity` |
| 💻 Shell | `run_command`, `spawn_process`, `list_processes`, `get_process_logs`, `kill_process`, `system_info`, `get_env`, `which`, `ps` |
| 🖥️ System | `disk_usage`, `open`, `notify`, `clipboard_read`, `clipboard_write`, `screenshot`, `list_installed`, `cron_list` |

---

## Quick start (Docker Compose — recommended)

```bash
# 1. Clone / copy this project
cd local-mcp

# 2. Set up your environment
cp .env.example .env
# Edit .env — fill in MCP_AUTH_TOKEN and NGROK_AUTHTOKEN

# 3. Start everything (MCP server + ngrok tunnel)
docker compose up -d

# 4. Find your public URL
docker compose logs ngrok | grep "url="
# → https://abc123.ngrok.io
```

Then add to Claude / Cursor (see "Connecting to LLMs" below).

---

## Quick start (local Node.js)

```bash
npm install
cp .env.example .env   # edit with your values
npm start
```

In another terminal:

```bash
ngrok http 3000 --request-header-add "x-mcp-token: YOUR_TOKEN"
```

---

## Connecting to LLMs

### Claude.ai
Settings → Integrations → Add MCP Server  
URL: `https://abc123.ngrok.io/mcp`  
Header: `X-MCP-Token: your-token`

### Cursor
Create or edit `.cursor/mcp.json` in your project:
```json
{
  "mcpServers": {
    "local-env": {
      "url": "https://abc123.ngrok.io/mcp",
      "headers": {
        "X-MCP-Token": "your-token"
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
      url: "https://abc123.ngrok.io/mcp",
      name: "local-env",
      authorization_token: "your-token",
    }],
    messages: [{ role: "user", content: "List my home directory" }]
  })
});
```

---

## Security

- **Always set `MCP_AUTH_TOKEN`** — every request must include `X-MCP-Token: <your-token>`.
- The `FS_ROOT` env var limits filesystem access. In Docker this is `/host-home` 
  (mapped to your real `$HOME` via volume mount).
- All paths are validated to stay within `FS_ROOT` — path traversal is blocked.
- Secret env vars (containing `token`, `key`, `password`, `secret`) are redacted from `get_env` output.
- **Never expose the MCP endpoint without a token on the public internet.**

---

## ngrok dashboard

While ngrok is running, visit: [http://localhost:4040](http://localhost:4040)

You can inspect all incoming requests, replay them, and monitor traffic.

---

## Checking health

```bash
curl http://localhost:3000/health
# or via ngrok:
curl https://abc123.ngrok.io/health
```

---

## Extending with more tools

Add a new file in `src/tools/your_tool.js`, export a `registerYourTools(server)` function,
and import it in `src/server.js`. The pattern is:

```javascript
export function registerYourTools(server) {
  server.tool(
    "tool_name",
    "Description for the LLM",
    { param: z.string() },   // zod schema
    async ({ param }) => ({
      content: [{ type: "text", text: "result" }]
    })
  );
}
```

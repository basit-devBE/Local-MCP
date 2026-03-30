import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { childLogger } from "../logger.js";

const log = childLogger("network");
const execAsync = promisify(exec);

function ok(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

export function registerNetworkTools(server) {

  server.tool(
    "http_request",
    "Make an HTTP/HTTPS request (like curl). Supports GET, POST, PUT, PATCH, DELETE.",
    {
      url: z.string().describe("Full URL to request"),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("GET"),
      headers: z.record(z.string()).optional().describe("Request headers"),
      body: z.string().optional().describe("Request body (JSON string or plain text)"),
      timeout_ms: z.number().optional().default(10000),
      follow_redirects: z.boolean().optional().default(true),
    },
    async ({ url, method, headers, body, timeout_ms, follow_redirects }) => {
      log.info("HTTP request", { method, url, timeout_ms, hasBody: Boolean(body) });
      const { default: fetch } = await import("node-fetch");
      const controller = new AbortController();
      const timer = setTimeout(() => {
        log.warn("HTTP request timed out", { method, url, timeout_ms });
        controller.abort();
      }, timeout_ms);

      const start = Date.now();
      try {
        const res = await fetch(url, {
          method,
          headers: { "User-Agent": "local-mcp/1.0", ...headers },
          body: body || undefined,
          redirect: follow_redirects ? "follow" : "manual",
          signal: controller.signal,
        });

        const elapsed = Date.now() - start;
        log.info("HTTP response received", { method, url, status: res.status, elapsed_ms: elapsed });

        const responseHeaders = Object.fromEntries(res.headers.entries());
        const text = await res.text();
        const truncated = text.length > 8000;
        if (truncated) log.debug("Response body truncated", { url, originalLength: text.length, truncatedTo: 8000 });

        const lines = [
          `Status:  ${res.status} ${res.statusText}`,
          `URL:     ${res.url}`,
          `Headers: ${JSON.stringify(responseHeaders, null, 2)}`,
          ``,
          `Body:`,
          truncated ? text.slice(0, 8000) + "\n... (truncated)" : text,
        ];
        return ok(lines.join("\n"));
      } finally {
        clearTimeout(timer);
      }
    }
  );

  server.tool(
    "ping",
    "Ping a host to check connectivity and latency.",
    {
      host: z.string().describe("Hostname or IP address"),
      count: z.number().optional().default(4),
    },
    async ({ host, count }) => {
      const cmd = process.platform === "win32"
        ? `ping -n ${count} ${host}`
        : `ping -c ${count} ${host}`;
      log.info("Pinging host", { host, count });
      try {
        const { stdout } = await execAsync(cmd, { timeout: 15000 });
        log.info("Ping completed", { host });
        return ok(stdout);
      } catch (e) {
        log.warn("Ping failed or host unreachable", { host, error: e.message });
        return ok(e.stdout || e.message);
      }
    }
  );

  server.tool(
    "dns_lookup",
    "Resolve DNS records for a domain.",
    {
      host: z.string(),
      type: z.enum(["A", "AAAA", "MX", "TXT", "CNAME", "NS", "SOA", "ALL"]).default("ALL"),
    },
    async ({ host, type }) => {
      log.info("DNS lookup", { host, type });
      const cmd = type === "ALL"
        ? `nslookup ${host} 2>&1 || host ${host} 2>&1 || dig ${host} 2>&1`
        : `dig ${host} ${type} +short 2>&1 || nslookup -type=${type} ${host} 2>&1`;
      try {
        const { stdout } = await execAsync(cmd, { timeout: 10000 });
        log.info("DNS lookup completed", { host, type });
        return ok(stdout || "(no results)");
      } catch (e) {
        log.warn("DNS lookup failed", { host, type, error: e.message });
        return ok(e.stdout || e.message);
      }
    }
  );

  server.tool(
    "port_scan",
    "Check if specific ports are open on a host. Not a full nmap — uses nc/netcat.",
    {
      host: z.string(),
      ports: z.array(z.number()).describe("List of ports to check, e.g. [22, 80, 443, 3000, 8080]"),
      timeout_ms: z.number().optional().default(2000),
    },
    async ({ host, ports, timeout_ms }) => {
      log.info("Port scan starting", { host, ports, timeout_ms });
      const results = [];
      let openCount = 0;
      for (const port of ports) {
        const timeoutSecs = Math.ceil(timeout_ms / 1000);
        try {
          await execAsync(`nc -z -w${timeoutSecs} ${host} ${port} 2>&1`, { timeout: timeout_ms + 500 });
          results.push(`  ${port.toString().padStart(5)}  ✅ OPEN`);
          openCount++;
        } catch {
          results.push(`  ${port.toString().padStart(5)}  ❌ CLOSED / FILTERED`);
        }
      }
      log.info("Port scan complete", { host, total: ports.length, open: openCount, closed: ports.length - openCount });
      return ok(`Port scan: ${host}\n${"─".repeat(30)}\n${results.join("\n")}`);
    }
  );

  server.tool(
    "whois",
    "Get WHOIS registration information for a domain or IP.",
    { query: z.string().describe("Domain or IP address") },
    async ({ query }) => {
      log.info("WHOIS lookup", { query });
      try {
        const { stdout } = await execAsync(`whois ${query} 2>&1`, { timeout: 10000 });
        log.info("WHOIS lookup completed", { query });
        return ok(stdout);
      } catch (e) {
        log.warn("WHOIS lookup failed", { query, error: e.message });
        return ok(e.stdout || e.message);
      }
    }
  );

  server.tool(
    "traceroute",
    "Trace the network path to a host.",
    { host: z.string() },
    async ({ host }) => {
      const cmd = process.platform === "darwin"
        ? `traceroute ${host}`
        : `traceroute -m 20 ${host} 2>&1`;
      log.info("Traceroute started", { host });
      try {
        const { stdout } = await execAsync(cmd, { timeout: 30000 });
        log.info("Traceroute complete", { host });
        return ok(stdout);
      } catch (e) {
        log.warn("Traceroute failed", { host, error: e.message });
        return ok(e.stdout || e.message);
      }
    }
  );

  server.tool(
    "download_file",
    "Download a file from a URL and save it to the local filesystem.",
    {
      url: z.string(),
      dest: z.string().describe("Destination path (relative to FS_ROOT)"),
    },
    async ({ url, dest }) => {
      const fs = await import("fs");
      const path = await import("path");
      const { default: fetch } = await import("node-fetch");
      const ROOT = process.env.FS_ROOT || "/host-home";
      const dp = path.resolve(ROOT, dest);
      log.info("Downloading file", { url, dest: dp });
      fs.mkdirSync(path.dirname(dp), { recursive: true });

      const res = await fetch(url);
      if (!res.ok) {
        log.error("Download failed — bad HTTP response", { url, status: res.status, statusText: res.statusText });
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const buf = await res.arrayBuffer();
      fs.writeFileSync(dp, Buffer.from(buf));
      log.info("File downloaded", { url, dest: dp, sizeKB: (buf.byteLength / 1024).toFixed(1) });
      return ok(`Downloaded ${url} → ${dp} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
    }
  );

  server.tool(
    "check_connectivity",
    "Quick check of internet connectivity and latency to common endpoints.",
    {},
    async () => {
      log.info("Running connectivity check");
      const { default: fetch } = await import("node-fetch");
      const targets = [
        ["1.1.1.1", "https://1.1.1.1/cdn-cgi/trace"],
        ["Google", "https://www.google.com"],
        ["GitHub", "https://api.github.com"],
      ];
      const results = [];
      for (const [name, url] of targets) {
        const start = Date.now();
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          const elapsed = Date.now() - start;
          results.push(`  ${name.padEnd(10)}  ✅ ${res.status}  ${elapsed}ms`);
          log.debug("Connectivity target reachable", { name, url, status: res.status, elapsed_ms: elapsed });
        } catch (e) {
          results.push(`  ${name.padEnd(10)}  ❌ ${e.message.slice(0, 40)}`);
          log.warn("Connectivity target unreachable", { name, url, error: e.message });
        }
      }
      log.info("Connectivity check complete");
      return ok(`Connectivity check:\n${"─".repeat(40)}\n${results.join("\n")}`);
    }
  );
}

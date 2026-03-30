import { exec, spawn } from "child_process";
import { promisify } from "util";
import os from "os";
import { z } from "zod";

const execAsync = promisify(exec);

function ok(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

const processes = new Map();
let procIdCounter = 1;

export function registerShellTools(server) {

  server.tool(
    "run_command",
    "Run a shell command and return its output. Working directory defaults to FS_ROOT.",
    {
      command: z.string().describe("Shell command to run"),
      cwd: z.string().optional().describe("Working directory (default: FS_ROOT)"),
      timeout_ms: z.number().optional().default(30000),
      env: z.record(z.string()).optional().describe("Extra environment variables"),
    },
    async ({ command, cwd, timeout_ms, env }) => {
      const workdir = cwd || process.env.FS_ROOT || "/host-home";
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: workdir,
          timeout: timeout_ms,
          env: { ...process.env, ...env },
          maxBuffer: 10 * 1024 * 1024,
        });
        const out = [
          stdout && `STDOUT:\n${stdout}`,
          stderr && `STDERR:\n${stderr}`,
        ].filter(Boolean).join("\n");
        return ok(out || "(no output)");
      } catch (e) {
        return ok(`EXIT ${e.code}\nSTDOUT:\n${e.stdout || ""}\nSTDERR:\n${e.stderr || e.message}`);
      }
    }
  );

  server.tool(
    "spawn_process",
    "Start a long-running process in the background (e.g. a dev server). Returns a process ID.",
    {
      command: z.string(),
      args: z.array(z.string()).optional().default([]),
      cwd: z.string().optional(),
      env: z.record(z.string()).optional(),
    },
    async ({ command, args, cwd, env }) => {
      const workdir = cwd || process.env.FS_ROOT || "/host-home";
      const id = procIdCounter++;
      const logs = [];

      const child = spawn(command, args, {
        cwd: workdir,
        env: { ...process.env, ...env },
        detached: false,
        stdio: "pipe",
      });

      child.stdout.on("data", d => logs.push(`[stdout] ${d.toString().trim()}`));
      child.stderr.on("data", d => logs.push(`[stderr] ${d.toString().trim()}`));
      child.on("exit", code => logs.push(`[exit] code ${code}`));

      processes.set(id, { child, logs, command, args, cwd: workdir, started: new Date() });
      return ok(`Started process #${id}: ${command} ${args.join(" ")}\nPID: ${child.pid}`);
    }
  );

  server.tool(
    "list_processes",
    "List all background processes started by spawn_process.",
    {},
    async () => {
      if (!processes.size) return ok("No background processes running.");
      const lines = [...processes.entries()].map(([id, { command, args, cwd, started, child }]) =>
        `#${id}  PID:${child.pid}  ${command} ${args.join(" ")}  cwd:${cwd}  started:${started.toISOString()}`
      );
      return ok(lines.join("\n"));
    }
  );

  server.tool(
    "get_process_logs",
    "Get stdout/stderr output from a background process.",
    {
      process_id: z.number(),
      last_n: z.number().optional().default(50).describe("Return last N lines"),
    },
    async ({ process_id, last_n }) => {
      const proc = processes.get(process_id);
      if (!proc) return ok(`No process with ID #${process_id}`);
      const lines = proc.logs.slice(-last_n);
      return ok(lines.join("\n") || "(no output yet)");
    }
  );

  server.tool(
    "kill_process",
    "Kill a background process by its ID (from spawn_process) or by PID.",
    {
      process_id: z.number().optional(),
      pid: z.number().optional(),
      signal: z.enum(["SIGTERM", "SIGKILL", "SIGHUP"]).optional().default("SIGTERM"),
    },
    async ({ process_id, pid, signal }) => {
      if (process_id !== undefined) {
        const proc = processes.get(process_id);
        if (!proc) return ok(`No process with ID #${process_id}`);
        proc.child.kill(signal);
        processes.delete(process_id);
        return ok(`Killed process #${process_id} with ${signal}`);
      }
      if (pid !== undefined) {
        process.kill(pid, signal);
        return ok(`Sent ${signal} to PID ${pid}`);
      }
      throw new Error("Provide either process_id or pid");
    }
  );

  server.tool(
    "system_info",
    "Get information about the host system: CPU, memory, disk, OS.",
    {},
    async () => {
      const freemem = os.freemem();
      const totalmem = os.totalmem();
      const usedPct = (((totalmem - freemem) / totalmem) * 100).toFixed(1);
      const lines = [
        `OS:       ${os.type()} ${os.release()} (${os.arch()})`,
        `Hostname: ${os.hostname()}`,
        `Uptime:   ${(os.uptime() / 3600).toFixed(1)} hours`,
        `CPUs:     ${os.cpus().length}x ${os.cpus()[0]?.model || "unknown"}`,
        `Memory:   ${(freemem / 1e9).toFixed(2)} GB free / ${(totalmem / 1e9).toFixed(2)} GB total (${usedPct}% used)`,
        `Load avg: ${os.loadavg().map(l => l.toFixed(2)).join(", ")}`,
        `User:     ${os.userInfo().username}`,
        `Home:     ${os.homedir()}`,
        `Tmp:      ${os.tmpdir()}`,
        `Node:     ${process.version}`,
      ];

      try {
        const { stdout: disk } = await execAsync("df -h / 2>/dev/null || df -h C: 2>/dev/null");
        lines.push(`\nDisk:\n${disk.trim()}`);
      } catch {}

      return ok(lines.join("\n"));
    }
  );

  server.tool(
    "get_env",
    "Get environment variables visible to the MCP server process.",
    {
      filter: z.string().optional().describe("Only return vars containing this string (case-insensitive)"),
      key: z.string().optional().describe("Get a specific variable by name"),
    },
    async ({ filter, key }) => {
      if (key) return ok(`${key}=${process.env[key] ?? "(not set)"}`);
      const entries = Object.entries(process.env);
      const filtered = filter
        ? entries.filter(([k]) => k.toLowerCase().includes(filter.toLowerCase()))
        : entries;
      const safe = filtered.map(([k, v]) =>
        /secret|token|password|key|api/i.test(k) ? `${k}=***REDACTED***` : `${k}=${v}`
      );
      return ok(safe.join("\n"));
    }
  );

  server.tool(
    "which",
    "Find the path of an executable on the system.",
    { command: z.string() },
    async ({ command }) => {
      try {
        const { stdout } = await execAsync(`which ${command} 2>/dev/null || where ${command} 2>/dev/null`);
        return ok(stdout.trim());
      } catch {
        return ok(`${command}: not found`);
      }
    }
  );

  server.tool(
    "ps",
    "List running system processes.",
    {
      filter: z.string().optional().describe("Filter by process name"),
      full: z.boolean().optional().default(false),
    },
    async ({ filter, full }) => {
      const cmd = process.platform === "win32"
        ? `tasklist`
        : full ? `ps aux` : `ps -eo pid,ppid,user,%cpu,%mem,comm,args --sort=-%cpu`;
      try {
        const { stdout } = await execAsync(cmd, { timeout: 5000 });
        if (filter) {
          const lines = stdout.split("\n").filter(l => l.toLowerCase().includes(filter.toLowerCase()));
          return ok(lines.join("\n") || "(no matching processes)");
        }
        return ok(stdout);
      } catch (e) {
        return ok(e.message);
      }
    }
  );
}

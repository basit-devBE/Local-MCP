import os from "os";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync } from "../../utils/shell.js";
import { childLogger } from "../../logger.js";

const log = childLogger("shell");

export const systemInfo: ToolDefinition = {
  name: "system_info",
  description: "Get information about the host system: CPU, memory, disk, OS.",
  schema: {},
  handler: async () => {
    log.debug("Collecting system info");
    const freemem = os.freemem();
    const totalmem = os.totalmem();
    const usedPct = (((totalmem - freemem) / totalmem) * 100).toFixed(1);
    const lines = [
      `OS:       ${os.type()} ${os.release()} (${os.arch()})`,
      `Hostname: ${os.hostname()}`,
      `Uptime:   ${(os.uptime() / 3600).toFixed(1)} hours`,
      `CPUs:     ${os.cpus().length}x ${os.cpus()[0]?.model || "unknown"}`,
      `Memory:   ${(freemem / 1e9).toFixed(2)} GB free / ${(totalmem / 1e9).toFixed(2)} GB total (${usedPct}% used)`,
      `Load avg: ${os.loadavg().map((l) => l.toFixed(2)).join(", ")}`,
      `User:     ${os.userInfo().username}`,
      `Home:     ${os.homedir()}`,
      `Tmp:      ${os.tmpdir()}`,
      `Node:     ${process.version}`,
    ];

    try {
      const { stdout: disk } = await execAsync("df -h / 2>/dev/null || df -h C: 2>/dev/null");
      lines.push(`\nDisk:\n${disk.trim()}`);
    } catch (e) {
      log.warn("Could not retrieve disk info", { error: (e as Error).message });
    }

    log.info("System info collected", { hostname: os.hostname(), memUsedPct: usedPct });
    return ok(lines.join("\n"));
  },
};

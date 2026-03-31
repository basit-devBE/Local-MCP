import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { execAsync, type ExecError } from "../../utils/shell.js";
import { config } from "../../config.js";
import { childLogger } from "../../logger.js";

const log = childLogger("shell");

export const runCommand: ToolDefinition = {
  name: "run_command",
  description: "Run a shell command and return its output. Working directory defaults to FS_ROOT.",
  schema: {
    command: z.string().describe("Shell command to run"),
    cwd: z.string().optional().describe("Working directory (default: FS_ROOT)"),
    timeout_ms: z.number().optional().default(30000),
    env: z.record(z.string()).optional().describe("Extra environment variables"),
  },
  handler: async ({ command, cwd, timeout_ms, env }) => {
    const workdir = cwd || config.fsRoot;
    log.info("Running shell command", { command, cwd: workdir, timeout_ms });
    const start = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workdir,
        timeout: timeout_ms,
        env: { ...process.env, ...env },
        maxBuffer: 10 * 1024 * 1024,
      });
      const elapsed = Date.now() - start;
      log.info("Command completed", { command, cwd: workdir, elapsed_ms: elapsed, hadStderr: Boolean(stderr) });
      const out = [
        stdout && `STDOUT:\n${stdout}`,
        stderr && `STDERR:\n${stderr}`,
      ].filter(Boolean).join("\n");
      return ok(out || "(no output)");
    } catch (err) {
      const e = err as ExecError;
      const elapsed = Date.now() - start;
      log.error("Command failed", { command, cwd: workdir, exitCode: e.code, elapsed_ms: elapsed, error: e.message });
      return ok(`EXIT ${e.code}\nSTDOUT:\n${e.stdout || ""}\nSTDERR:\n${e.stderr || e.message}`);
    }
  },
};

import { spawn } from "child_process";
import type { ManagedProcess } from "../types/index.js";
import { childLogger } from "../logger.js";

const log = childLogger("processManager");

export interface SpawnOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export class ProcessManager {
  private processes = new Map<number, ManagedProcess>();
  private nextId = 1;

  spawn(options: SpawnOptions): ManagedProcess {
    const id = this.nextId++;
    const args = options.args ?? [];
    const cwd = options.cwd ?? process.cwd();
    const processLogs: string[] = [];

    log.info("Spawning background process", { id, command: options.command, args, cwd });

    const child = spawn(options.command, args, {
      cwd,
      env: { ...process.env, ...options.env },
      detached: false,
      stdio: "pipe",
    });

    child.stdout?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      processLogs.push(`[stdout] ${line}`);
      log.debug(`Process #${id} stdout`, { pid: child.pid, line });
    });

    child.stderr?.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      processLogs.push(`[stderr] ${line}`);
      log.debug(`Process #${id} stderr`, { pid: child.pid, line });
    });

    child.on("exit", (code) => {
      processLogs.push(`[exit] code ${code}`);
      log.info(`Process #${id} exited`, { pid: child.pid, exitCode: code });
      this.processes.delete(id);
    });

    const managed: ManagedProcess = {
      id,
      child,
      logs: processLogs,
      command: options.command,
      args,
      cwd,
      started: new Date(),
    };

    this.processes.set(id, managed);
    log.info("Background process started", { id, pid: child.pid, command: options.command });
    return managed;
  }

  list(): ManagedProcess[] {
    return [...this.processes.values()];
  }

  get(id: number): ManagedProcess | undefined {
    return this.processes.get(id);
  }

  getLogs(id: number, lastN = 50): string[] {
    const proc = this.processes.get(id);
    if (!proc) return [];
    return proc.logs.slice(-lastN);
  }

  kill(id: number, signal: NodeJS.Signals = "SIGTERM"): boolean {
    const proc = this.processes.get(id);
    if (!proc) return false;

    log.info("Killing background process", { id, pid: proc.child.pid, signal });
    proc.child.kill(signal);
    this.processes.delete(id);
    return true;
  }

  killByPid(pid: number, signal: NodeJS.Signals = "SIGTERM"): void {
    log.info("Sending signal to system PID", { pid, signal });
    process.kill(pid, signal);
  }

  get size(): number {
    return this.processes.size;
  }
}

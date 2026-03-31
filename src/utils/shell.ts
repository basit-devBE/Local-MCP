import { exec } from "child_process";
import { promisify } from "util";

export const execAsync = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  code?: number;
}

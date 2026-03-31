import path from "path";
import { config } from "../config.js";
import { childLogger } from "../logger.js";

const log = childLogger("paths");

export function safePath(inputPath: string): string {
  const resolved = path.resolve(config.fsRoot, inputPath.replace(/^~/, config.fsRoot));
  if (!resolved.startsWith(config.fsRoot)) {
    log.warn("Path traversal attempt blocked", { inputPath, resolved, root: config.fsRoot });
    throw new Error(`Access denied: path is outside allowed root (${config.fsRoot})`);
  }
  return resolved;
}

export function repoPath(inputPath: string): string {
  return path.resolve(config.fsRoot, inputPath.replace(/^~/, config.fsRoot));
}

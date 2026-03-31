import fs from "fs";
import path from "path";
import { glob } from "glob";
import { z } from "zod";
import type { ToolDefinition } from "../../types/index.js";
import { ok } from "../../utils/response.js";
import { safePath } from "../../utils/paths.js";
import { childLogger } from "../../logger.js";

const log = childLogger("filesystem");

export const searchFiles: ToolDefinition = {
  name: "search_files",
  description: "Search for files by glob pattern or text content inside files.",
  schema: {
    base_path: z.string().describe("Directory to search in"),
    pattern: z.string().optional().describe("Glob pattern, e.g. '**/*.js'"),
    content_search: z.string().optional().describe("Search for this text inside files"),
    max_results: z.number().optional().default(50),
  },
  handler: async ({ base_path, pattern, content_search, max_results }) => {
    const bp = safePath(base_path);
    log.debug("Searching files", { base_path: bp, pattern, content_search, max_results });
    const results: string[] = [];

    if (pattern) {
      const matches = await glob(pattern, {
        cwd: bp,
        absolute: true,
        ignore: ["**/node_modules/**", "**/.git/**"],
      });
      const sliced = matches.slice(0, max_results);
      results.push(...sliced.map((m) => `📄 ${path.relative(bp, m)}`));
      log.debug("Glob pattern search complete", {
        pattern,
        totalMatches: matches.length,
        returned: sliced.length,
      });
    }

    if (content_search) {
      const allFiles = await glob("**/*", {
        cwd: bp,
        absolute: true,
        nodir: true,
        ignore: ["**/node_modules/**", "**/.git/**"],
      });
      let scanned = 0;
      for (const file of allFiles) {
        if (results.length >= max_results) break;
        try {
          const content = fs.readFileSync(file, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(content_search)) {
              results.push(`📄 ${path.relative(bp, file)}:${i + 1}  ${lines[i].trim()}`);
            }
          }
          scanned++;
        } catch {
          // Skip unreadable files
        }
      }
      log.debug("Content search complete", {
        query: content_search,
        filesScanned: scanned,
        matchesFound: results.length,
      });
    }

    log.info("File search done", { base_path: bp, totalResults: results.length });
    return ok(results.length ? results.join("\n") : "No results found.");
  },
};

import fs from "fs";
import path from "path";
import { glob } from "glob";
import mime from "mime-types";
import { z } from "zod";
import { childLogger } from "../logger.js";

const log = childLogger("filesystem");
const ROOT = process.env.FS_ROOT || "/host-home";

function safePath(inputPath) {
  const resolved = path.resolve(ROOT, inputPath.replace(/^~/, ROOT));
  if (!resolved.startsWith(ROOT)) {
    log.warn("Path traversal attempt blocked", { inputPath, resolved, root: ROOT });
    throw new Error(`Access denied: path is outside allowed root (${ROOT})`);
  }
  return resolved;
}

function ok(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

export function registerFilesystemTools(server) {

  server.tool(
    "read_file",
    "Read the contents of a file. Returns text for text files, base64 for binary.",
    { path: z.string().describe("File path relative to FS_ROOT or absolute") },
    async ({ path: p }) => {
      const fp = safePath(p);
      log.debug("Reading file", { path: fp });
      const mimeType = mime.lookup(fp) || "application/octet-stream";
      const isBinary = !mimeType.startsWith("text/") && !mimeType.includes("json") && !mimeType.includes("xml") && !mimeType.includes("javascript");
      if (isBinary) {
        const data = fs.readFileSync(fp).toString("base64");
        log.info("Read binary file (base64)", { path: fp, mimeType, sizeBytes: data.length });
        return ok(`[Binary file — base64]\n${data}`);
      }
      const content = fs.readFileSync(fp, "utf-8");
      log.info("Read text file", { path: fp, mimeType, lines: content.split("\n").length });
      return ok(content);
    }
  );

  server.tool(
    "write_file",
    "Write content to a file. Creates parent directories if needed.",
    {
      path: z.string().describe("Destination file path"),
      content: z.string().describe("Text content to write"),
      append: z.boolean().optional().default(false).describe("Append instead of overwrite"),
    },
    async ({ path: p, content, append }) => {
      const fp = safePath(p);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      if (append) {
        fs.appendFileSync(fp, content, "utf-8");
        log.info("Appended to file", { path: fp, bytesWritten: content.length });
        return ok(`Appended ${content.length} chars to ${fp}`);
      }
      fs.writeFileSync(fp, content, "utf-8");
      log.info("Wrote file", { path: fp, bytesWritten: content.length });
      return ok(`Written ${content.length} chars to ${fp}`);
    }
  );

  server.tool(
    "list_dir",
    "List files and directories at a given path with metadata.",
    {
      path: z.string().describe("Directory path"),
      recursive: z.boolean().optional().default(false),
      show_hidden: z.boolean().optional().default(false),
    },
    async ({ path: p, recursive, show_hidden }) => {
      const fp = safePath(p);
      log.debug("Listing directory", { path: fp, recursive, show_hidden });
      const entries = [];

      function walk(dir, depth = 0) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (!show_hidden && item.name.startsWith(".")) continue;
          const full = path.join(dir, item.name);
          const rel = path.relative(fp, full);
          const stat = fs.statSync(full);
          const prefix = "  ".repeat(depth);
          const type = item.isDirectory() ? "📁" : "📄";
          const size = item.isFile() ? ` (${(stat.size / 1024).toFixed(1)}KB)` : "";
          entries.push(`${prefix}${type} ${rel}${size}`);
          if (recursive && item.isDirectory()) walk(full, depth + 1);
        }
      }

      walk(fp);
      log.info("Listed directory", { path: fp, entryCount: entries.length, recursive });
      return ok(entries.join("\n") || "(empty directory)");
    }
  );

  server.tool(
    "make_dir",
    "Create a directory (and any missing parents).",
    { path: z.string() },
    async ({ path: p }) => {
      const fp = safePath(p);
      fs.mkdirSync(fp, { recursive: true });
      log.info("Created directory", { path: fp });
      return ok(`Directory created: ${fp}`);
    }
  );

  server.tool(
    "delete_path",
    "Delete a file or directory (recursive for directories).",
    { path: z.string(), recursive: z.boolean().optional().default(false) },
    async ({ path: p, recursive }) => {
      const fp = safePath(p);
      const stat = fs.statSync(fp);
      const isDir = stat.isDirectory();
      log.warn("Deleting path", { path: fp, type: isDir ? "directory" : "file", recursive });
      if (isDir) {
        fs.rmSync(fp, { recursive });
      } else {
        fs.unlinkSync(fp);
      }
      log.info("Deleted path", { path: fp });
      return ok(`Deleted: ${fp}`);
    }
  );

  server.tool(
    "copy_path",
    "Copy a file or directory to a destination.",
    { src: z.string(), dest: z.string() },
    async ({ src, dest }) => {
      const sp = safePath(src);
      const dp = safePath(dest);
      log.debug("Copying path", { src: sp, dest: dp });
      fs.mkdirSync(path.dirname(dp), { recursive: true });
      fs.cpSync(sp, dp, { recursive: true });
      log.info("Copied path", { src: sp, dest: dp });
      return ok(`Copied ${sp} → ${dp}`);
    }
  );

  server.tool(
    "move_path",
    "Move or rename a file or directory.",
    { src: z.string(), dest: z.string() },
    async ({ src, dest }) => {
      const sp = safePath(src);
      const dp = safePath(dest);
      log.debug("Moving path", { src: sp, dest: dp });
      fs.mkdirSync(path.dirname(dp), { recursive: true });
      fs.renameSync(sp, dp);
      log.info("Moved path", { src: sp, dest: dp });
      return ok(`Moved ${sp} → ${dp}`);
    }
  );

  server.tool(
    "search_files",
    "Search for files by glob pattern or text content inside files.",
    {
      base_path: z.string().describe("Directory to search in"),
      pattern: z.string().optional().describe("Glob pattern, e.g. '**/*.js'"),
      content_search: z.string().optional().describe("Search for this text inside files"),
      max_results: z.number().optional().default(50),
    },
    async ({ base_path, pattern, content_search, max_results }) => {
      const bp = safePath(base_path);
      log.debug("Searching files", { base_path: bp, pattern, content_search, max_results });
      const results = [];

      if (pattern) {
        const matches = await glob(pattern, { cwd: bp, absolute: true, ignore: ["**/node_modules/**", "**/.git/**"] });
        const sliced = matches.slice(0, max_results);
        results.push(...sliced.map(m => `📄 ${path.relative(bp, m)}`));
        log.debug("Glob pattern search complete", { pattern, totalMatches: matches.length, returned: sliced.length });
      }

      if (content_search) {
        const allFiles = await glob("**/*", { cwd: bp, absolute: true, nodir: true, ignore: ["**/node_modules/**", "**/.git/**"] });
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
          } catch { /* skip binary or unreadable */ }
        }
        log.debug("Content search complete", { query: content_search, filesScanned: scanned, matchesFound: results.length });
      }

      log.info("File search done", { base_path: bp, totalResults: results.length });
      return ok(results.length ? results.join("\n") : "No results found.");
    }
  );

  server.tool(
    "file_info",
    "Get metadata about a file or directory.",
    { path: z.string() },
    async ({ path: p }) => {
      const fp = safePath(p);
      log.debug("Fetching file info", { path: fp });
      const stat = fs.statSync(fp);
      log.info("File info retrieved", { path: fp, type: stat.isDirectory() ? "directory" : "file", sizeKB: (stat.size / 1024).toFixed(2) });
      return ok([
        `Path:     ${fp}`,
        `Type:     ${stat.isDirectory() ? "directory" : "file"}`,
        `Size:     ${(stat.size / 1024).toFixed(2)} KB`,
        `MIME:     ${mime.lookup(fp) || "unknown"}`,
        `Modified: ${stat.mtime.toISOString()}`,
        `Created:  ${stat.birthtime.toISOString()}`,
        `Mode:     ${(stat.mode & 0o777).toString(8)}`,
      ].join("\n"));
    }
  );
}

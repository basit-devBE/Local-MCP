import simpleGit from "simple-git";
import path from "path";
import { z } from "zod";

const ROOT = process.env.FS_ROOT || "/host-home";

function repoPath(p) {
  return path.resolve(ROOT, p.replace(/^~/, ROOT));
}

function ok(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

function git(repoDir) {
  return simpleGit(repoDir);
}

export function registerGitTools(server) {

  server.tool(
    "git_status",
    "Get the current status of a git repository.",
    { repo: z.string().describe("Path to the git repository") },
    async ({ repo }) => {
      const g = git(repoPath(repo));
      const status = await g.status();
      const lines = [
        `Branch:   ${status.current}`,
        `Ahead:    ${status.ahead} | Behind: ${status.behind}`,
        `Staged:   ${status.staged.join(", ") || "none"}`,
        `Modified: ${status.modified.join(", ") || "none"}`,
        `Untracked:${status.not_added.join(", ") || "none"}`,
        `Deleted:  ${status.deleted.join(", ") || "none"}`,
        `Conflicts:${status.conflicted.join(", ") || "none"}`,
      ];
      return ok(lines.join("\n"));
    }
  );

  server.tool(
    "git_diff",
    "Show diff of working tree, staged changes, or between commits.",
    {
      repo: z.string(),
      staged: z.boolean().optional().default(false).describe("Show staged (index) diff"),
      file: z.string().optional().describe("Limit diff to this file"),
      from: z.string().optional().describe("From commit/branch"),
      to: z.string().optional().describe("To commit/branch"),
    },
    async ({ repo, staged, file, from, to }) => {
      const g = git(repoPath(repo));
      let diff;
      if (from && to) {
        diff = await g.diff([from, to, ...(file ? ["--", file] : [])]);
      } else if (staged) {
        diff = await g.diff(["--cached", ...(file ? ["--", file] : [])]);
      } else {
        diff = await g.diff(file ? ["--", file] : []);
      }
      return ok(diff || "(no changes)");
    }
  );

  server.tool(
    "git_log",
    "Show commit history for a repository.",
    {
      repo: z.string(),
      max_count: z.number().optional().default(20),
      branch: z.string().optional(),
      file: z.string().optional(),
    },
    async ({ repo, max_count, branch, file }) => {
      const g = git(repoPath(repo));
      const log = await g.log({
        maxCount: max_count,
        ...(branch ? { from: branch } : {}),
        ...(file ? { file } : {}),
      });
      const lines = log.all.map(c =>
        `${c.hash.slice(0, 8)}  ${c.date.slice(0, 10)}  ${c.author_name.padEnd(20)}  ${c.message}`
      );
      return ok(lines.join("\n") || "(no commits)");
    }
  );

  server.tool(
    "git_branch",
    "List, create, or delete branches.",
    {
      repo: z.string(),
      action: z.enum(["list", "create", "delete", "checkout"]).default("list"),
      name: z.string().optional().describe("Branch name for create/delete/checkout"),
      remote: z.boolean().optional().default(false).describe("Include remote branches when listing"),
    },
    async ({ repo, action, name, remote }) => {
      const g = git(repoPath(repo));
      if (action === "list") {
        const branches = await g.branch(remote ? ["-a"] : []);
        const lines = Object.values(branches.branches).map(b =>
          `${b.current ? "* " : "  "}${b.name}`
        );
        return ok(lines.join("\n"));
      }
      if (!name) throw new Error("Branch name required for this action");
      if (action === "create") { await g.checkoutLocalBranch(name); return ok(`Created and checked out branch: ${name}`); }
      if (action === "delete") { await g.deleteLocalBranch(name); return ok(`Deleted branch: ${name}`); }
      if (action === "checkout") { await g.checkout(name); return ok(`Checked out: ${name}`); }
    }
  );

  server.tool(
    "git_add",
    "Stage files for commit.",
    {
      repo: z.string(),
      files: z.array(z.string()).optional().describe("Files to stage, omit for all"),
    },
    async ({ repo, files }) => {
      const g = git(repoPath(repo));
      await g.add(files?.length ? files : ["-A"]);
      return ok(`Staged: ${files?.join(", ") || "all changes"}`);
    }
  );

  server.tool(
    "git_commit",
    "Commit staged changes.",
    {
      repo: z.string(),
      message: z.string().describe("Commit message"),
      author_name: z.string().optional(),
      author_email: z.string().optional(),
    },
    async ({ repo, message, author_name, author_email }) => {
      const g = git(repoPath(repo));
      const opts = {};
      if (author_name && author_email) {
        opts["--author"] = `${author_name} <${author_email}>`;
      }
      const result = await g.commit(message, opts);
      return ok(`Committed: ${result.commit}\nSummary: ${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`);
    }
  );

  server.tool(
    "git_push",
    "Push commits to a remote.",
    {
      repo: z.string(),
      remote: z.string().optional().default("origin"),
      branch: z.string().optional(),
      force: z.boolean().optional().default(false),
    },
    async ({ repo, remote, branch, force }) => {
      const g = git(repoPath(repo));
      const args = force ? ["--force"] : [];
      await g.push(remote, branch, args);
      return ok(`Pushed to ${remote}${branch ? "/" + branch : ""}`);
    }
  );

  server.tool(
    "git_pull",
    "Pull latest changes from a remote.",
    {
      repo: z.string(),
      remote: z.string().optional().default("origin"),
      branch: z.string().optional(),
      rebase: z.boolean().optional().default(false),
    },
    async ({ repo, remote, branch, rebase }) => {
      const g = git(repoPath(repo));
      const result = await g.pull(remote, branch, rebase ? { "--rebase": null } : {});
      return ok(`Pulled: ${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`);
    }
  );

  server.tool(
    "git_clone",
    "Clone a remote git repository.",
    {
      url: z.string().describe("Repository URL"),
      dest: z.string().describe("Local destination path"),
      depth: z.number().optional().describe("Shallow clone depth"),
    },
    async ({ url, dest }) => {
      const dp = path.resolve(ROOT, dest);
      const g = simpleGit();
      await g.clone(url, dp);
      return ok(`Cloned ${url} → ${dp}`);
    }
  );

  server.tool(
    "git_stash",
    "Stash or pop working changes.",
    {
      repo: z.string(),
      action: z.enum(["save", "pop", "list", "drop"]).default("save"),
      message: z.string().optional(),
    },
    async ({ repo, action, message }) => {
      const g = git(repoPath(repo));
      if (action === "save") { await g.stash(message ? ["push", "-m", message] : []); return ok("Stashed changes"); }
      if (action === "pop") { await g.stash(["pop"]); return ok("Popped stash"); }
      if (action === "list") { const list = await g.stashList(); return ok(list.all.map(s => s.message).join("\n") || "(empty stash)"); }
      if (action === "drop") { await g.stash(["drop"]); return ok("Dropped top stash"); }
    }
  );

  server.tool(
    "git_show",
    "Show the content and diff of a specific commit.",
    {
      repo: z.string(),
      commit: z.string().default("HEAD"),
    },
    async ({ repo, commit }) => {
      const g = git(repoPath(repo));
      const result = await g.show([commit, "--stat"]);
      return ok(result);
    }
  );
}

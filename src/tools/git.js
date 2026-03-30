import simpleGit from "simple-git";
import path from "path";
import { z } from "zod";
import { childLogger } from "../logger.js";

const log  = childLogger("git");
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
      const rp     = repoPath(repo);
      log.info("Getting git status", { repo: rp });
      const status = await git(rp).status();
      log.debug("Git status fetched", {
        repo:      rp,
        branch:    status.current,
        ahead:     status.ahead,
        behind:    status.behind,
        staged:    status.staged.length,
        modified:  status.modified.length,
        untracked: status.not_added.length,
      });
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
      repo:   z.string(),
      staged: z.boolean().optional().default(false).describe("Show staged (index) diff"),
      file:   z.string().optional().describe("Limit diff to this file"),
      from:   z.string().optional().describe("From commit/branch"),
      to:     z.string().optional().describe("To commit/branch"),
    },
    async ({ repo, staged, file, from, to }) => {
      const rp = repoPath(repo);
      log.info("Getting git diff", { repo: rp, staged, file, from, to });
      const g = git(rp);
      let diff;
      if (from && to) {
        diff = await g.diff([from, to, ...(file ? ["--", file] : [])]);
      } else if (staged) {
        diff = await g.diff(["--cached", ...(file ? ["--", file] : [])]);
      } else {
        diff = await g.diff(file ? ["--", file] : []);
      }
      log.debug("Diff computed", { repo: rp, diffLength: diff?.length ?? 0 });
      return ok(diff || "(no changes)");
    }
  );

  server.tool(
    "git_log",
    "Show commit history for a repository.",
    {
      repo:      z.string(),
      max_count: z.number().optional().default(20),
      branch:    z.string().optional(),
      file:      z.string().optional(),
    },
    async ({ repo, max_count, branch, file }) => {
      const rp     = repoPath(repo);
      log.info("Getting git log", { repo: rp, max_count, branch, file });
      const result = await git(rp).log({
        maxCount: max_count,
        ...(branch ? { from: branch } : {}),
        ...(file   ? { file }         : {}),
      });
      log.debug("Git log fetched", { repo: rp, commitCount: result.all.length });
      const lines = result.all.map(c =>
        `${c.hash.slice(0, 8)}  ${c.date.slice(0, 10)}  ${c.author_name.padEnd(20)}  ${c.message}`
      );
      return ok(lines.join("\n") || "(no commits)");
    }
  );

  server.tool(
    "git_branch",
    "List, create, or delete branches.",
    {
      repo:   z.string(),
      action: z.enum(["list", "create", "delete", "checkout"]).default("list"),
      name:   z.string().optional().describe("Branch name for create/delete/checkout"),
      remote: z.boolean().optional().default(false).describe("Include remote branches when listing"),
    },
    async ({ repo, action, name, remote }) => {
      const rp = repoPath(repo);
      log.info("Git branch operation", { repo: rp, action, name, remote });
      const g  = git(rp);
      if (action === "list") {
        const branches = await g.branch(remote ? ["-a"] : []);
        const lines    = Object.values(branches.branches).map(b => `${b.current ? "* " : "  "}${b.name}`);
        log.debug("Branches listed", { repo: rp, count: lines.length });
        return ok(lines.join("\n"));
      }
      if (!name) throw new Error("Branch name required for this action");
      if (action === "create") {
        await g.checkoutLocalBranch(name);
        log.info("Branch created and checked out", { repo: rp, branch: name });
        return ok(`Created and checked out branch: ${name}`);
      }
      if (action === "delete") {
        await g.deleteLocalBranch(name);
        log.info("Branch deleted", { repo: rp, branch: name });
        return ok(`Deleted branch: ${name}`);
      }
      if (action === "checkout") {
        await g.checkout(name);
        log.info("Checked out branch", { repo: rp, branch: name });
        return ok(`Checked out: ${name}`);
      }
    }
  );

  server.tool(
    "git_add",
    "Stage files for commit.",
    {
      repo:  z.string(),
      files: z.array(z.string()).optional().describe("Files to stage, omit for all"),
    },
    async ({ repo, files }) => {
      const rp = repoPath(repo);
      log.info("Staging files", { repo: rp, files: files ?? "all" });
      await git(rp).add(files?.length ? files : ["-A"]);
      log.debug("Files staged", { repo: rp });
      return ok(`Staged: ${files?.join(", ") || "all changes"}`);
    }
  );

  server.tool(
    "git_commit",
    "Commit staged changes.",
    {
      repo:         z.string(),
      message:      z.string().describe("Commit message"),
      author_name:  z.string().optional(),
      author_email: z.string().optional(),
    },
    async ({ repo, message, author_name, author_email }) => {
      const rp   = repoPath(repo);
      log.info("Creating git commit", { repo: rp, message, author: author_name });
      const opts = {};
      if (author_name && author_email) {
        opts["--author"] = `${author_name} <${author_email}>`;
      }
      const result = await git(rp).commit(message, opts);
      log.info("Commit created", {
        repo:       rp,
        commitHash: result.commit,
        changes:    result.summary.changes,
        insertions: result.summary.insertions,
        deletions:  result.summary.deletions,
      });
      return ok(`Committed: ${result.commit}\nSummary: ${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`);
    }
  );

  server.tool(
    "git_push",
    "Push commits to a remote.",
    {
      repo:   z.string(),
      remote: z.string().optional().default("origin"),
      branch: z.string().optional(),
      force:  z.boolean().optional().default(false),
    },
    async ({ repo, remote, branch, force }) => {
      const rp   = repoPath(repo);
      log.info("Pushing to remote", { repo: rp, remote, branch, force });
      const args = force ? ["--force"] : [];
      await git(rp).push(remote, branch, args);
      log.info("Push complete", { repo: rp, remote, branch });
      return ok(`Pushed to ${remote}${branch ? "/" + branch : ""}`);
    }
  );

  server.tool(
    "git_pull",
    "Pull latest changes from a remote.",
    {
      repo:   z.string(),
      remote: z.string().optional().default("origin"),
      branch: z.string().optional(),
      rebase: z.boolean().optional().default(false),
    },
    async ({ repo, remote, branch, rebase }) => {
      const rp     = repoPath(repo);
      log.info("Pulling from remote", { repo: rp, remote, branch, rebase });
      const result = await git(rp).pull(remote, branch, rebase ? { "--rebase": null } : {});
      log.info("Pull complete", {
        repo:       rp,
        remote,
        changes:    result.summary.changes,
        insertions: result.summary.insertions,
        deletions:  result.summary.deletions,
      });
      return ok(`Pulled: ${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`);
    }
  );

  server.tool(
    "git_clone",
    "Clone a remote git repository.",
    {
      url:   z.string().describe("Repository URL"),
      dest:  z.string().describe("Local destination path"),
      depth: z.number().optional().describe("Shallow clone depth"),
    },
    async ({ url, dest }) => {
      const dp = path.resolve(ROOT, dest);
      log.info("Cloning repository", { url, dest: dp });
      await simpleGit().clone(url, dp);
      log.info("Clone complete", { url, dest: dp });
      return ok(`Cloned ${url} → ${dp}`);
    }
  );

  server.tool(
    "git_stash",
    "Stash or pop working changes.",
    {
      repo:    z.string(),
      action:  z.enum(["save", "pop", "list", "drop"]).default("save"),
      message: z.string().optional(),
    },
    async ({ repo, action, message }) => {
      const rp = repoPath(repo);
      log.info("Git stash operation", { repo: rp, action, message });
      const g  = git(rp);
      if (action === "save") {
        await g.stash(message ? ["push", "-m", message] : []);
        log.info("Changes stashed", { repo: rp, message });
        return ok("Stashed changes");
      }
      if (action === "pop") {
        await g.stash(["pop"]);
        log.info("Stash popped", { repo: rp });
        return ok("Popped stash");
      }
      if (action === "list") {
        const list = await g.stashList();
        log.debug("Stash list fetched", { repo: rp, count: list.all.length });
        return ok(list.all.map(s => s.message).join("\n") || "(empty stash)");
      }
      if (action === "drop") {
        await g.stash(["drop"]);
        log.info("Top stash dropped", { repo: rp });
        return ok("Dropped top stash");
      }
    }
  );

  server.tool(
    "git_show",
    "Show the content and diff of a specific commit.",
    {
      repo:   z.string(),
      commit: z.string().default("HEAD"),
    },
    async ({ repo, commit }) => {
      const rp     = repoPath(repo);
      log.info("Showing commit", { repo: rp, commit });
      const result = await git(rp).show([commit, "--stat"]);
      return ok(result);
    }
  );
}

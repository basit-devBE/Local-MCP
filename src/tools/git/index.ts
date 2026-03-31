import type { ToolDefinition } from "../../types/index.js";
import { gitStatus } from "./status.js";
import { gitDiff } from "./diff.js";
import { gitLog } from "./log.js";
import { gitBranch } from "./branch.js";
import { gitAdd } from "./add.js";
import { gitCommit } from "./commit.js";
import { gitPush } from "./push.js";
import { gitPull } from "./pull.js";
import { gitClone } from "./clone.js";
import { gitStash } from "./stash.js";
import { gitShow } from "./show.js";

export const gitTools: ToolDefinition[] = [
  gitStatus,
  gitDiff,
  gitLog,
  gitBranch,
  gitAdd,
  gitCommit,
  gitPush,
  gitPull,
  gitClone,
  gitStash,
  gitShow,
];

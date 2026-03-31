import type { ToolDefinition } from "../../types/index.js";
import { readFile } from "./readFile.js";
import { writeFile } from "./writeFile.js";
import { listDir } from "./listDir.js";
import { makeDir } from "./makeDir.js";
import { deletePath } from "./deletePath.js";
import { copyPath } from "./copyPath.js";
import { movePath } from "./movePath.js";
import { searchFiles } from "./searchFiles.js";
import { fileInfo } from "./fileInfo.js";

export const filesystemTools: ToolDefinition[] = [
  readFile,
  writeFile,
  listDir,
  makeDir,
  deletePath,
  copyPath,
  movePath,
  searchFiles,
  fileInfo,
];

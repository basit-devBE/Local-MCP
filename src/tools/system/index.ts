import type { ToolDefinition } from "../../types/index.js";
import { cronList } from "./cronList.js";
import { diskUsage } from "./diskUsage.js";
import { open } from "./open.js";
import { notify } from "./notify.js";
import { clipboardWrite } from "./clipboardWrite.js";
import { clipboardRead } from "./clipboardRead.js";
import { screenshot } from "./screenshot.js";
import { listInstalled } from "./listInstalled.js";

export const systemTools: ToolDefinition[] = [
  cronList,
  diskUsage,
  open,
  notify,
  clipboardWrite,
  clipboardRead,
  screenshot,
  listInstalled,
];

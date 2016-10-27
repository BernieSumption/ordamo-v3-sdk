
/// <reference path="../../typings/index.d.ts" />

import * as fs from "fs";
import * as path from "path";

export function ensureParentDirExists(file: string) {
  let dirName = path.dirname(file);
  if (!fs.existsSync(dirName)) {
    ensureParentDirExists(dirName);
    fs.mkdirSync(dirName);
  }
}

export function fatalError(message: string) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

export interface Command {
  name: string;
  doc: string;
  args?: { name: string, doc: string, optional?: boolean; }[];
  func: Function;
}

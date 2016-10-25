#! /usr/bin/env node

/// <reference path="../../node_modules/retyped-node-tsd-ambient/node.d.ts" />


"use strict";

import path = require("path");
import fs = require("fs");

const STANDARD_SCRIPT_FOLDER = "app/content";

const METADATA_FILES = ["metadata"];

const COMMANDS: Command[] = [
  {
    name: "generate",
    doc: `Generate a single metadata file`,
    args: [
      {
        name: "TYPE",
        doc: `one of: ${METADATA_FILES.join(", ")}`
      },
      {
        name: "MODULE_PATH",
        doc: `the path to a JS or TS module exporting a function called "get". See the examples in the SDK demo app for what these functions should return.`
      }
    ],
    func: generateCommand
  },
  {
    name: "generate-all",
    args: [],
    doc: `Generate all metadata files assuming that metadata files are located in ${STANDARD_SCRIPT_FOLDER} and named ${METADATA_FILES.map(m => m + ".ts").join(", ")}`,
    func: generateAllCommand,
  }
];

if (process.argv.length < 3) {
  fatalError("Not enough arguments");
}

COMMANDS.forEach(c => { if (c.func.length !== c.args.length) { throw new Error(`${c.name} definition error, function args not correctly documented`) } });

let [commandName, ...args] = process.argv.slice(2);

let command = COMMANDS.find(c => c.name === commandName);

if (!command) {
  fatalError(`Invalid command "${commandName}"`);
}

if (args.length !== command.func.length) {
  fatalError(`Expected exactly ${command.func.length} arguments after "${command.name}""`);
}

command.func.apply(null, args);

function generateCommand(modulePath: string, functionName: string, outputFile: string) {
  let mod = require(path.resolve(modulePath));
  let content = mod[functionName]();
  let encoded = JSON.stringify(content, null, "  ");
  outputFile = path.resolve(outputFile);
  ensureParentDirExists(outputFile);
  fs.writeFileSync(outputFile, encoded, { encoding: "utf8" });
  console.log(`Wrote result of ${functionName}() to "${path.relative(".", outputFile)}"`);
}


function generateAllCommand(scriptFolder: string, outputFolder: string) {
  generateCommand(
    path.resolve(scriptFolder, "default-content"),
    "getContent",
    path.resolve(outputFolder, "default-content.json"));
  generateCommand(
    path.resolve(scriptFolder, "metadata"),
    "getMetadata",
    path.resolve(outputFolder, "metadata.json"));
  generateCommand(
    path.resolve(scriptFolder, "schema"),
    "getSchema",
    path.resolve(outputFolder, "schema.json"));
}



function fatalError(message: string) {
  let commandDocs = COMMANDS.map(command => {
    let args = (command.args || []).map(a => a.name).join(" ");
    let argDocs = (command.args || [])
      .map(a => `${a.name}: ${a.doc}`)
      .join("\n\t\t");
    if (argDocs !== "") argDocs = "\n\t\t" + argDocs;
    return `ordamo-v3-sdk ${command.name} ${args}\n\t${command.doc}${argDocs}`;
  });
  console.error(`${message}\nUsage:\n${commandDocs.join("\n")}`.replace(/\t/g, "   "));
  process.exit(1);
}



function ensureParentDirExists(file: string) {
  let dirName = path.dirname(file);
  if (!fs.existsSync(dirName)) {
    ensureParentDirExists(dirName);
    fs.mkdirSync(dirName);
  }
}

interface Command {
  name: string;
  doc: string;
  args?: { name: string, doc: string }[];
  func: Function;
}
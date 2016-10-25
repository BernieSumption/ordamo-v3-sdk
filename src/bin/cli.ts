#! /usr/bin/env node

/// <reference path="../../node_modules/retyped-node-tsd-ambient/node.d.ts" />


import path = require("path");
import fs = require("fs");
import * as sdk from "../index";
require("typescript-require");

const COMMANDS: Command[] = [
  {
    name: "build-content",
    args: [
      {
        name: "CONTENT_FOLDER",
        doc: `The folder containing metadata.ts, schema.ts and default-content.ts. See the SDK demo app for structure of these files.`
      },
      {
        name: "OUTPUT_FOLDER",
        doc: `The build output folder to save the generated content to.`
      }
    ],
    doc: `Generate all content and metadata files.`,
    func: generateAllCommand,
  }
];

if (process.argv.length < 3) {
  fatalError("Not enough arguments");
}

COMMANDS.forEach(c => { if (c.func.length !== c.args.length) { throw new Error(`"${c.name}" command definition error, function args not correctly documented`) } });

let [commandName, ...args] = process.argv.slice(2);

let command = COMMANDS.find(c => c.name === commandName);

if (!command) {
  fatalError(`Invalid command "${commandName}"`);
}

if (args.length !== command.func.length) {
  fatalError(`Expected exactly ${command.func.length} arguments after "${command.name}""`);
}

command.func.apply(null, args);

// function generateCommand(type: string, modulePath: string, outputFolder: string) {
//   let displayModulePath = modulePath.replace(path.resolve("."), "");
//   if (displayModulePath[0] === path.sep) {
//     displayModulePath = displayModulePath.slice(1);
//   }
//   require("typescript-require");
//   let mod = require(path.resolve(modulePath));
//   if (!mod.default) {
//     throw new Error(`Module at ${displayModulePath} has no default export.`);
//   }
//   let content = mod.default();
//   let encoded = JSON.stringify(content, null, "  ");
//   let outputFile = path.resolve(outputFolder, `${type}.json`);
//   outputFile = path.resolve(outputFile);
//   ensureParentDirExists(outputFile);
//   fs.writeFileSync(outputFile, encoded, { encoding: "utf8" });
//   console.log(`Wrote result of default() in ${displayModulePath} to "${path.relative(".", outputFile)}"`);
// }

function getModuleDefaultOutput(contentFolder: string, type: string): any {
  let modulePath = path.resolve(contentFolder, type);
  let mod = require(path.resolve(modulePath));
  if (!mod.default) {
    throw new Error(`Module at ${path.join(contentFolder, type)} has no default export.`);
  }
  return mod.default();
}

function writeContentFile(content: any, outputFolder: string, type: string) {
  let encoded = JSON.stringify(content, null, "  ");
  let outputFile = path.resolve(outputFolder, `${type}.json`);
  outputFile = path.resolve(outputFile);
  ensureParentDirExists(outputFile);
  fs.writeFileSync(outputFile, encoded, { encoding: "utf8" });
  console.log(`Wrote output of default() in ${type}.ts to "${path.relative(".", outputFile)}"`);
}


function generateAllCommand(contentFolder: string, outputFolder: string) {
  let schema = getModuleDefaultOutput(contentFolder, "schema");
  writeContentFile(schema, outputFolder, "schema");

  let metadata = getModuleDefaultOutput(contentFolder, "metadata");
  
  TODO: copy images here
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

/**
 * Validate a content object against a schema.
 *
 * This function validates that the content has the right set of fields, but does
 * not perform semantic validation e.g. checking that the lengths of strings are
 * within the defined minLength and maxLength bounds.
 */
function validateContent(schema: any, content: any) {
  for (let key in schema) {
    if (!(key in content)) {
      throw new Error(`Schema contains item "${key} that is missing from the content.`);
    }
    let schemaItem: sdk.ContentDescriptor<any> & sdk.ListOptions<any> = schema[key];
    if (schemaItem.type === "image" || schemaItem.type === "text") {
      validateType([content[key]], "string", "a string", key);
    }
    if (schemaItem.type === "number") {
      validateType([content[key]], "number", "a number", key);
    }
    if (schemaItem.type === "list") {
      if (!Array.isArray(content[key])) {
        throw new Error(`Expected content.${key} to be an array, but it is a ${typeof content[key]}`);
      } else {
        if (schemaItem.items.type === "image" || schemaItem.items.type === "text") {
          validateType(content[key], "string", "an array of strings", key);
        }
        if (schemaItem.type === "number") {
          validateType(content[key], "number", "an array of numbers", key);
        }
      }
    }
  }
  for (let key in content) {
    if (!(key in schema)) {
      throw new Error(`Content contains item "${key}" that doesn't exist in the schema.`);
    }
  }
  return content;

  function validateType(items: any[], expectedType: string, expectedTypeHuman: string, key: string) {
    for (let item of items) {
      if (typeof item !== expectedType) {
        throw new Error(`Expected content.${key} to be ${expectedTypeHuman}, but it contains a ${typeof item}`);
      }
    }
  }
}

// silence console.error because subpackage depreciation notices are printed on exit and they're useless
console.error = function () { };

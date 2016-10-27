#! /usr/bin/env node

/// <reference path="../../typings/index.d.ts" />


import path = require("path");
import fs = require("fs");
import * as sdk from "../index";
import * as rimraf from "rimraf";
require("typescript-require");

const COMMANDS: Command[] = [
  {
    name: "build-content",
    args: [
      {
        name: "SOURCE_FOLDER",
        doc: `The folder containing metadata.ts, schema.ts and default-content.ts. See the SDK demo app for structure of these files.`
      },
      {
        name: "OUTPUT_FOLDER",
        doc: `The build output folder to save the generated content to.`
      },
      {
        name: "ASSETS_FOLDER",
        doc: `The folder containing the app's static assets, used to verify that the files referenced by metadata.ts and default-content.ts exist.`,
        optional: true
      }
    ],
    doc: `Generate all content and metadata files.`,
    func: generateAllCommand,
  }
];

if (process.argv.length < 3) {
  usageError("Not enough arguments");
}

COMMANDS.forEach(c => { if (c.func.length !== c.args.length) { throw new Error(`"${c.name}" command definition error, function args not correctly documented`) } });

let [commandName, ...args] = process.argv.slice(2);

let command = COMMANDS.find(c => c.name === commandName);

if (!command) {
  usageError(`Invalid command "${commandName}"`);
}

let minArgs = command.args.filter(a => !a.optional).length;
let maxArgs = command.args.length;

if (args.length < minArgs || args.length > maxArgs) {
  let count = minArgs === maxArgs ? `exactly ${minArgs}` : `${minArgs} to ${maxArgs}`;
  usageError(`Expected ${count} arguments after "${command.name}"s`);
}

command.func.apply(null, args);


function generateAllCommand(contentSourceFolder: string, buildFolder: string, assetsFolder: string = buildFolder) {

  const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif"];
  const VIDEO_EXTENSIONS = ["mp4", "ogv", "webm"];

  process.once("exit", cleanup);

  let contentSchema = getModuleDefaultOutput("content-schema");
  writeJSONFile(contentSchema, "content-schema");

  let defaultContent: any = getModuleDefaultOutput("default-content");
  validateDefaultContent(contentSchema, defaultContent);
  writeJSONFile(defaultContent, "default-content");

  let appPackageJson = getAppPackageJSON(contentSourceFolder);

  let metadata: sdk.AppMetadata = getModuleDefaultOutput("metadata");
  let keymap: any = {
    "id": "name",
    "description": "description",
    "version": "version"
  }
  for (let prop in keymap) {
    if ((metadata as any)[prop] === sdk.AUTO_METADATA) {
      (metadata as any)[prop] = appPackageJson[keymap[prop]];
    }
  }
  writeJSONFile(metadata, "metadata");
  validateImage(metadata.defaultIconSrc, "metadata.defaultIconSrc", false);
  validateMenuNodes(metadata.menuNodes, "metadata.menuNodes");

  let tmpDir = path.join(process.cwd(), "tmp");
  let tsRequireDir = path.join(tmpDir, "tsreq");

  function cleanup() {
    if (fs.existsSync(tsRequireDir)) {
      rimraf.sync(tsRequireDir);
      try {
        fs.rmdirSync(tmpDir);
      } catch (e) {
        // leave tmp dir there is it's not empty, something else might be using it
      }
    }
  }

  function getAppPackageJSON(p: string) {
    let testPath = path.resolve(p);
    let prevPath = testPath;
    do {
      let testPackageFile = path.join(testPath, "package.json");
      if (fs.existsSync(testPackageFile)) {
        return JSON.parse(fs.readFileSync(testPackageFile, "utf8"));
      }
      prevPath = testPath;
      testPath = path.dirname(testPath);
    } while (testPath && testPath !== prevPath);
    throw new Error(`Can't find package.json in "${p}" or any parent directories.`);
  }


  function validateDefaultContent(schema: any, content: any) {
    for (let key in schema) {
      if (!(key in content)) {
        fatalError(`Schema contains item "${key} that is missing from the content.`);
      }
      let schemaItem: sdk.ContentDescriptor<any> & sdk.ListOptions<sdk.ImageOptions & sdk.ContentDescriptor<any>> & sdk.ImageOptions = schema[key];
      if (schemaItem.type === "image") {
        validateType([content[key]], "string", "a relative file path", key);
        validateImage(content[key], `content.${key}`, schemaItem.isVideo);
      }
      if (schemaItem.type === "text") {
        validateType([content[key]], "string", "a string", key);
      }
      if (schemaItem.type === "number") {
        validateType([content[key]], "number", "a number", key);
      }
      if (schemaItem.type === "list") {
        if (!Array.isArray(content[key])) {
          fatalError(`Expected content.${key} to be an array, but it is a ${typeof content[key]}`);
        } else {
          if (schemaItem.items.type === "image") {
            validateType(content[key], "string", "an array of relative file paths", key);
            (content[key] as string[]).forEach((path, i) => validateImage(path, `content.${key}[${i}]`, schemaItem.items.isVideo));
          }
          if (schemaItem.items.type === "text") {
            validateType(content[key], "string", "an array of strings", key);
          }
          if (schemaItem.items.type === "number") {
            validateType(content[key], "number", "an array of numbers", key);
          }
        }
      }
    }
    for (let key in content) {
      if (!(key in schema)) {
        fatalError(`Content contains item "${key}" that doesn't exist in the schema.`);
      }
    }
    return content;

    function validateType(items: any[], expectedType: string, expectedTypeHuman: string, key: string) {
      for (let item of items) {
        if (typeof item !== expectedType) {
          fatalError(`Expected content.${key} to be ${expectedTypeHuman}, but it contains a ${typeof item}`);
        }
      }
    }
  }


  function validateMenuNodes(nodes: sdk.MenuNode[], propName: string) {
    if (nodes) {
      nodes.forEach((child, i) => validateMenuNode(child, `${propName}[${i}]`));
    }
  }

  function validateMenuNode(node: sdk.MenuNode, propName: string) {
    validateImage(node.iconSrc, `${propName}.iconSrc`, false);
    validateMenuNodes(node.children, `${propName}.children`);
  }

  function validateImage(imagePath: string, propName: string, isVideo: boolean) {
    let source = path.resolve(assetsFolder, imagePath);
    if (!fs.existsSync(source)) {
      fatalError(`File "${source}" is referenced by ${propName} but does not exist.`);
    }
    let extensions = isVideo ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
    let extension = source.replace(/^[^\.]*\./, "").toLowerCase();
    if (extensions.indexOf(extension) === -1) {
      fatalError(`File "${source}" referenced by ${propName} is th wrong type; supported extensions are: ${extensions.join(", ")}`);
    }
  }

  function getModuleDefaultOutput(type: string): any {
    let modulePath = path.resolve(contentSourceFolder, type);
    let mod = require(path.resolve(modulePath));
    if (!mod.default) {
      fatalError(`Module at ${path.join(contentSourceFolder, type)} has no default export.`);
    }
    return mod.default();
  }

  function writeJSONFile(content: any, type: string) {
    let encoded = JSON.stringify(content, null, "  ");
    let outputFile = path.resolve(buildFolder, `${type}.json`);
    outputFile = path.resolve(outputFile);
    ensureParentDirExists(outputFile);
    fs.writeFileSync(outputFile, encoded, { encoding: "utf8" });
    console.log(`Wrote output of ${type}.ts to "${nicePath(outputFile)}"`);
  }

}





function nicePath(p: string) {
  p = p.replace(path.resolve("."), "");
  if (p[0] === path.sep) {
    p = p.slice(1);
  }
  return p;
}




function usageError(message: string) {
  let commandDocs = COMMANDS.map(command => {
    let args = (command.args || []).map(a => a.name).join(" ");
    let argDocs = (command.args || [])
      .map(a => `${a.name}: ${a.doc}`)
      .join("\n\t\t");
    if (argDocs !== "") argDocs = "\n\t\t" + argDocs;
    return `ordamo-v3-sdk ${command.name} ${args}\n\t${command.doc}${argDocs}`;
  });
  fatalError(`${message}\nUsage:\n${commandDocs.join("\n")}`.replace(/\t/g, "   "));
}

function fatalError(message: string) {
  console.error(`ERROR: ${message}`);
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
  args?: { name: string, doc: string, optional?: boolean; }[];
  func: Function;
}


// silence console.error because subpackage depreciation notices are printed on exit and they're useless
console.error = function () { };

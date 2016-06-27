#! /usr/bin/env node

/// <reference path="../../node_modules/retyped-node-tsd-ambient/node.d.ts" />


"use strict";

import path = require("path");
import fs = require("fs");

if (process.argv.length < 3) {
  fatalError("Not enough arguments");
}

let [commandName, ...args] = process.argv.slice(2);

if (commandName === "generate") {
  doCommand("generate", generateCommand, args);
} else if (commandName === "generate-all") {
  doCommand("generate-all", generateAllCommand, args);
} else if (commandName === "concat-app-to-html") {
  doCommand("concat-app-to-html", concatAppToHtmlCommand, args);
} else if (commandName === "write-debug-html") {
  doCommand("write-debug-html", writeAppHtmlCommand, args.concat(["app.js", "app.css"]));
} else if (commandName === "write-app-html") {
  doCommand("write-app-html", writeAppHtmlCommand, args);
} else {
  fatalError(`Invalid command "${commandName}"`);
}


function doCommand(name: string, f: Function, args: string[]) {
  if (args.length !== f.length) {
    fatalError(`Expected exactly ${f.length} arguments after "${name}""`);
  }
  f.apply(null, args);
}


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

function concatAppToHtmlCommand(jsFile: string, cssFile: string, outFile: string) {

  let jsContent = fs.readFileSync(jsFile, "utf8");
  let cssContent = fs.readFileSync(cssFile, "utf8");

  if (jsContent.toLowerCase().indexOf("</script>") !== -1) {
    console.error(`JS file "${jsFile}" contains the string "</script>" and therefore can't be embedded in HTML.`);
  }

  if (cssContent.toLowerCase().indexOf("</style>") !== -1) {
    console.error(`JS file "${jsFile}" contains the string "</style>" and therefore can't be embedded in HTML.`);
  }

  let result = `
<html>
<head>
<meta charset="UTF-8">
<style>
${cssContent}
</style>
</head>
<body>
<script>
${jsContent}
</script>
</body>
</html>
`;

  ensureParentDirExists(outFile);
  fs.writeFileSync(outFile, result, { encoding: "utf8" });
}

function writeAppHtmlCommand(outFile: string, jsFile: string , cssFile: string) {
  let result = `
<html>
<head>
    <meta charset="UTF-8">
    <script>
    var appStyle = document.createElement("link");
    appStyle.setAttribute("rel", "stylesheet");
    appStyle.setAttribute("type", "text/css");
    appStyle.setAttribute("href", ${JSON.stringify(cssFile)} + document.location.search);
    document.head.appendChild(appStyle);
    </script>
</head>
<body>
<script>
var appScript = document.createElement("script");
appScript.setAttribute("src", ${JSON.stringify(jsFile)} + document.location.search);
document.body.appendChild(appScript);
</script>
</body>
</html>
`;
  ensureParentDirExists(outFile);
  fs.writeFileSync(outFile, result, { encoding: "utf8" });
}



function fatalError(message: string) {
  console.error(`${message}
Usage:
Generate a single metadata JSON file
  node ${path.basename(process.argv[1])} generate modulePath functionName outputFile
  e.g. "generate content/default-content getContent build/out/default-content.json"
Generate all metadata files assuming standard locations:
  node ${path.basename(process.argv[1])} generate-all script-folder output-folder`);
  process.exit(1);
}



function ensureParentDirExists(file: string) {
  let dirName = path.dirname(file);
  if (!fs.existsSync(dirName)) {
    ensureParentDirExists(dirName);
    fs.mkdirSync(dirName);
  }
}

#! /usr/bin/env node
"use strict";
var path = require("path");
var fs = require("fs");
var STANDARD_SCRIPT_FOLDER = "app/content";
var METADATA_FILES = ["metadata"];
var COMMANDS = [
    {
        name: "generate",
        doc: "Generate a single metadata file",
        args: [
            {
                name: "TYPE",
                doc: "one of: " + METADATA_FILES.join(", ")
            },
            {
                name: "MODULE_PATH",
                doc: "the path to a JS or TS module exporting a function called \"get\". See the examples in the SDK demo app for what these functions should return."
            }
        ],
        func: generateCommand
    },
    {
        name: "generate-all",
        args: [],
        doc: "Generate all metadata files assuming that metadata files are located in " + STANDARD_SCRIPT_FOLDER + " and named " + METADATA_FILES.map(function (m) { return m + ".ts"; }).join(", "),
        func: generateAllCommand,
    }
];
if (process.argv.length < 3) {
    fatalError("Not enough arguments");
}
COMMANDS.forEach(function (c) { if (c.func.length !== c.args.length) {
    throw new Error(c.name + " definition error, function args not correctly documented");
} });
var _a = process.argv.slice(2), commandName = _a[0], args = _a.slice(1);
var command = COMMANDS.find(function (c) { return c.name === commandName; });
if (!command) {
    fatalError("Invalid command \"" + commandName + "\"");
}
if (args.length !== command.func.length) {
    fatalError("Expected exactly " + command.func.length + " arguments after \"" + command.name + "\"\"");
}
command.func.apply(null, args);
function generateCommand(modulePath, functionName, outputFile) {
    var mod = require(path.resolve(modulePath));
    var content = mod[functionName]();
    var encoded = JSON.stringify(content, null, "  ");
    outputFile = path.resolve(outputFile);
    ensureParentDirExists(outputFile);
    fs.writeFileSync(outputFile, encoded, { encoding: "utf8" });
    console.log("Wrote result of " + functionName + "() to \"" + path.relative(".", outputFile) + "\"");
}
function generateAllCommand(scriptFolder, outputFolder) {
    generateCommand(path.resolve(scriptFolder, "default-content"), "getContent", path.resolve(outputFolder, "default-content.json"));
    generateCommand(path.resolve(scriptFolder, "metadata"), "getMetadata", path.resolve(outputFolder, "metadata.json"));
    generateCommand(path.resolve(scriptFolder, "schema"), "getSchema", path.resolve(outputFolder, "schema.json"));
}
function fatalError(message) {
    var commandDocs = COMMANDS.map(function (command) {
        var args = (command.args || []).map(function (a) { return a.name; }).join(" ");
        var argDocs = (command.args || [])
            .map(function (a) { return (a.name + ": " + a.doc); })
            .join("\n\t\t");
        if (argDocs !== "")
            argDocs = "\n\t\t" + argDocs;
        return "ordamo-v3-sdk " + command.name + " " + args + "\n\t" + command.doc + argDocs;
    });
    console.error((message + "\nUsage:\n" + commandDocs.join("\n")).replace(/\t/g, "   "));
    process.exit(1);
}
function ensureParentDirExists(file) {
    var dirName = path.dirname(file);
    if (!fs.existsSync(dirName)) {
        ensureParentDirExists(dirName);
        fs.mkdirSync(dirName);
    }
}

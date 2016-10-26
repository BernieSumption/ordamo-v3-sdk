#! /usr/bin/env node
"use strict";
var path = require("path");
var fs = require("fs");
var sdk = require("../index");
var rimraf = require("rimraf");
require("typescript-require");
var COMMANDS = [
    {
        name: "build-content",
        args: [
            {
                name: "SOURCE_FOLDER",
                doc: "The folder containing metadata.ts, schema.ts and default-content.ts. See the SDK demo app for structure of these files."
            },
            {
                name: "OUTPUT_FOLDER",
                doc: "The build output folder to save the generated content to."
            },
            {
                name: "ASSETS_FOLDER",
                doc: "The folder containing the app's static assets, used to verify that the files referenced by metadata.ts and default-content.ts exist.",
                optional: true
            }
        ],
        doc: "Generate all content and metadata files.",
        func: generateAllCommand,
    }
];
if (process.argv.length < 3) {
    usageError("Not enough arguments");
}
COMMANDS.forEach(function (c) { if (c.func.length !== c.args.length) {
    throw new Error("\"" + c.name + "\" command definition error, function args not correctly documented");
} });
var _a = process.argv.slice(2), commandName = _a[0], args = _a.slice(1);
var command = COMMANDS.find(function (c) { return c.name === commandName; });
if (!command) {
    usageError("Invalid command \"" + commandName + "\"");
}
var minArgs = command.args.filter(function (a) { return !a.optional; }).length;
var maxArgs = command.args.length;
if (args.length < minArgs || args.length > maxArgs) {
    var count = minArgs === maxArgs ? "exactly " + minArgs : minArgs + " to " + maxArgs;
    usageError("Expected " + count + " arguments after \"" + command.name + "\"s");
}
command.func.apply(null, args);
function generateAllCommand(contentSourceFolder, buildFolder, assetsFolder) {
    if (assetsFolder === void 0) { assetsFolder = contentSourceFolder; }
    process.once("exit", cleanup);
    var contentSchema = getModuleDefaultOutput("content-schema");
    writeJSONFile(contentSchema, "content-schema");
    var defaultContent = getModuleDefaultOutput("default-content");
    validateDefaultContent(contentSchema, defaultContent);
    writeJSONFile(defaultContent, "default-content");
    var appPackageJson = getAppPackageJSON(contentSourceFolder);
    var metadata = getModuleDefaultOutput("metadata");
    for (var prop in metadata) {
        if (metadata[prop] === sdk.AUTO_METADATA) {
            metadata[prop] = appPackageJson[prop];
        }
    }
    writeJSONFile(metadata, "metadata");
    validateImage(metadata.defaultIconSrc, "metadata.defaultIconSrc");
    validateMenuNodes(metadata.menuNodes, "metadata.menuNodes");
    var tmpDir = path.join(process.cwd(), "tmp");
    var tsRequireDir = path.join(tmpDir, "tsreq");
    function cleanup() {
        rimraf.sync(tsRequireDir);
        try {
            fs.rmdirSync(tmpDir);
        }
        catch (e) {
        }
    }
    function getAppPackageJSON(p) {
        var testPath = path.resolve(p);
        var prevPath = testPath;
        do {
            var testPackageFile = path.join(testPath, "package.json");
            if (fs.existsSync(testPackageFile)) {
                return JSON.parse(fs.readFileSync(testPackageFile, "utf8"));
            }
            prevPath = testPath;
            testPath = path.dirname(testPath);
        } while (testPath && testPath !== prevPath);
        throw new Error("Can't find package.json in \"" + p + "\" or any parent directories.");
    }
    function validateDefaultContent(schema, content) {
        var _loop_1 = function(key) {
            if (!(key in content)) {
                fatalError("Schema contains item \"" + key + " that is missing from the content.");
            }
            var schemaItem = schema[key];
            if (schemaItem.type === "image") {
                validateType([content[key]], "string", "a relative file path", key);
                validateImage(content[key], "content." + key);
            }
            if (schemaItem.type === "text") {
                validateType([content[key]], "string", "a string", key);
            }
            if (schemaItem.type === "number") {
                validateType([content[key]], "number", "a number", key);
            }
            if (schemaItem.type === "list") {
                if (!Array.isArray(content[key])) {
                    fatalError("Expected content." + key + " to be an array, but it is a " + typeof content[key]);
                }
                else {
                    if (schemaItem.items.type === "image") {
                        validateType(content[key], "string", "an array of relative file paths", key);
                        content[key].forEach(function (path, i) { return validateImage(path, "content." + key + "[" + i + "]"); });
                    }
                    if (schemaItem.items.type === "text") {
                        validateType(content[key], "string", "an array of strings", key);
                    }
                    if (schemaItem.type === "number") {
                        validateType(content[key], "number", "an array of numbers", key);
                    }
                }
            }
        };
        for (var key in schema) {
            _loop_1(key);
        }
        for (var key in content) {
            if (!(key in schema)) {
                fatalError("Content contains item \"" + key + "\" that doesn't exist in the schema.");
            }
        }
        return content;
        function validateType(items, expectedType, expectedTypeHuman, key) {
            for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
                var item = items_1[_i];
                if (typeof item !== expectedType) {
                    fatalError("Expected content." + key + " to be " + expectedTypeHuman + ", but it contains a " + typeof item);
                }
            }
        }
    }
    function validateMenuNodes(nodes, propName) {
        if (nodes) {
            nodes.forEach(function (child, i) { return validateMenuNode(child, propName + "[" + i + "]"); });
        }
    }
    function validateMenuNode(node, propName) {
        validateImage(node.iconSrc, propName + ".iconSrc");
        validateMenuNodes(node.children, propName + ".children");
    }
    function validateImage(imagePath, propName) {
        var source = path.resolve(assetsFolder, imagePath);
        if (!fs.existsSync(source)) {
            fatalError("File \"" + source + "\" is referenced by " + propName + " but does not exist.");
        }
    }
    function getModuleDefaultOutput(type) {
        var modulePath = path.resolve(contentSourceFolder, type);
        var mod = require(path.resolve(modulePath));
        if (!mod.default) {
            fatalError("Module at " + path.join(contentSourceFolder, type) + " has no default export.");
        }
        return mod.default();
    }
    function writeJSONFile(content, type) {
        var encoded = JSON.stringify(content, null, "  ");
        var outputFile = path.resolve(buildFolder, type + ".json");
        outputFile = path.resolve(outputFile);
        ensureParentDirExists(outputFile);
        fs.writeFileSync(outputFile, encoded, { encoding: "utf8" });
        console.log("Wrote output of " + type + ".ts to \"" + nicePath(outputFile) + "\"");
    }
}
function nicePath(p) {
    p = p.replace(path.resolve("."), "");
    if (p[0] === path.sep) {
        p = p.slice(1);
    }
    return p;
}
function usageError(message) {
    var commandDocs = COMMANDS.map(function (command) {
        var args = (command.args || []).map(function (a) { return a.name; }).join(" ");
        var argDocs = (command.args || [])
            .map(function (a) { return (a.name + ": " + a.doc); })
            .join("\n\t\t");
        if (argDocs !== "")
            argDocs = "\n\t\t" + argDocs;
        return "ordamo-v3-sdk " + command.name + " " + args + "\n\t" + command.doc + argDocs;
    });
    fatalError((message + "\nUsage:\n" + commandDocs.join("\n")).replace(/\t/g, "   "));
}
function fatalError(message) {
    console.error("ERROR: " + message);
    process.exit(1);
}
function ensureParentDirExists(file) {
    var dirName = path.dirname(file);
    if (!fs.existsSync(dirName)) {
        ensureParentDirExists(dirName);
        fs.mkdirSync(dirName);
    }
}
// silence console.error because subpackage depreciation notices are printed on exit and they're useless
console.error = function () { };

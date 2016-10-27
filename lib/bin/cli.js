#! /usr/bin/env node
"use strict";
var build_content_command_1 = require("./build-content-command");
var write_app_html_command_1 = require("./write-app-html-command");
var utils_1 = require("./utils");
require("typescript-require");
var COMMANDS = [build_content_command_1.default, write_app_html_command_1.default];
if (process.argv.length < 3) {
    usageError("Not enough arguments");
}
COMMANDS.forEach(function (c) { if (c.func.length !== c.args.length) {
    throw new Error("\"" + c.name + "\" command definition error, function args not correctly documented");
} });
var _a = process.argv.slice(2), commandName = _a[0], args = _a.slice(1);
var command = COMMANDS.filter(function (c) { return c.name === commandName; })[0];
if (!command) {
    usageError("Invalid command \"" + commandName + "\"");
}
var minArgs = command.args.filter(function (a) { return !a.optional; }).length;
var maxArgs = command.args.length;
if (args.length < minArgs || args.length > maxArgs) {
    var count = minArgs === maxArgs ? "exactly " + minArgs : minArgs + " to " + maxArgs;
    usageError("Expected " + count + " arguments after \"" + command.name + "\"");
}
command.func.apply(null, args);
function usageError(message) {
    var commandDocs = COMMANDS.map(function (command) {
        var args = (command.args || []).map(function (a) { return a.optional ? "[" + a.name + "]" : a.name; }).join(" ");
        var argDocs = (command.args || [])
            .map(function (a) { return (a.name + ": " + a.doc); })
            .join("\n\t\t");
        if (argDocs !== "")
            argDocs = "\n\t\t" + argDocs;
        return "ordamo-v3-sdk " + command.name + " " + args + "\n\t" + command.doc + argDocs;
    });
    utils_1.fatalError((message + "\nUsage:\n" + commandDocs.join("\n")).replace(/\t/g, "   "));
}
// silence console.error because subpackage depreciation notices are printed on exit and they're useless
console.error = function () { };

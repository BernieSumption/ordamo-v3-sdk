#! /usr/bin/env node

/// <reference path="../../typings/index.d.ts" />


import buildContentCOmmand from "./build-content-command";
import writeAppHtmlCommand from "./write-app-html-command";
import {fatalError, Command} from "./utils";
require("typescript-require");

const COMMANDS: Command[] = [buildContentCOmmand, writeAppHtmlCommand];

if (process.argv.length < 3) {
  usageError("Not enough arguments");
}

COMMANDS.forEach(c => { if (c.func.length !== c.args.length) { throw new Error(`"${c.name}" command definition error, function args not correctly documented`); } });

let [commandName, ...args] = process.argv.slice(2);

let command = COMMANDS.filter(c => c.name === commandName)[0];

if (!command) {
  usageError(`Invalid command "${commandName}"`);
}

let minArgs = command.args.filter(a => !a.optional).length;
let maxArgs = command.args.length;

if (args.length < minArgs || args.length > maxArgs) {
  let count = minArgs === maxArgs ? `exactly ${minArgs}` : `${minArgs} to ${maxArgs}`;
  usageError(`Expected ${count} arguments after "${command.name}"`);
}

command.func.apply(null, args);




function usageError(message: string) {
  let commandDocs = COMMANDS.map(command => {
    let args = (command.args || []).map(a => a.optional ? `[${a.name}]` : a.name).join(" ");
    let argDocs = (command.args || [])
      .map(a => `${a.name}: ${a.doc}`)
      .join("\n\t\t");
    if (argDocs !== "") argDocs = "\n\t\t" + argDocs;
    return `ordamo-v3-sdk ${command.name} ${args}\n\t${command.doc}${argDocs}`;
  });
  fatalError(`${message}\nUsage:\n${commandDocs.join("\n")}`.replace(/\t/g, "   "));
}






// silence console.error because subpackage depreciation notices are printed on exit and they're useless
console.error = function () { };

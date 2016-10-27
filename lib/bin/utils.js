/// <reference path="../../typings/index.d.ts" />
"use strict";
var fs = require("fs");
var path = require("path");
function ensureParentDirExists(file) {
    var dirName = path.dirname(file);
    if (!fs.existsSync(dirName)) {
        ensureParentDirExists(dirName);
        fs.mkdirSync(dirName);
    }
}
exports.ensureParentDirExists = ensureParentDirExists;
function fatalError(message) {
    console.error("ERROR: " + message);
    process.exit(1);
}
exports.fatalError = fatalError;

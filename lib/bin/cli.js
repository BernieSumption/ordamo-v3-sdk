#! /usr/bin/env node
"use strict";
var path = require("path");
var fs = require("fs");
if (process.argv.length < 3) {
    fatalError("Not enough arguments");
}
var _a = process.argv.slice(2), commandName = _a[0], args = _a.slice(1);
if (commandName === "generate") {
    doCommand("generate", generateCommand, args);
}
else if (commandName === "generate-all") {
    doCommand("generate-all", generateAllCommand, args);
}
else if (commandName === "concat-app-to-html") {
    doCommand("concat-app-to-html", concatAppToHtmlCommand, args);
}
else if (commandName === "write-debug-html") {
    doCommand("write-debug-html", writeDebugHtmlCommand, args);
}
else {
    fatalError("Invalid command \"" + commandName + "\"");
}
function doCommand(name, f, args) {
    if (args.length !== f.length) {
        fatalError("Expected exactly " + f.length + " arguments after \"" + name + "\"\"");
    }
    f.apply(null, args);
}
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
function concatAppToHtmlCommand(jsFile, cssFile, outFile) {
    var jsContent = fs.readFileSync(jsFile, "utf8");
    var cssContent = fs.readFileSync(cssFile, "utf8");
    if (jsContent.toLowerCase().indexOf("</script>") !== -1) {
        console.error("JS file \"" + jsFile + "\" contains the string \"</script>\" and therefore can't be embedded in HTML.");
    }
    if (cssContent.toLowerCase().indexOf("</style>") !== -1) {
        console.error("JS file \"" + jsFile + "\" contains the string \"</style>\" and therefore can't be embedded in HTML.");
    }
    var result = "\n<html>\n<head>\n<meta charset=\"UTF-8\">\n<style>\n" + cssContent + "\n</style>\n</head>\n<body>\n<script>\n" + jsContent + "\n</script>\n</body>\n</html>\n";
    ensureParentDirExists(outFile);
    fs.writeFileSync(outFile, result, { encoding: "utf8" });
}
function writeDebugHtmlCommand(outFile) {
    var result = "\n<html>\n<head>\n    <meta charset=\"UTF-8\">\n    <link rel=\"stylesheet\" type=\"text/css\" href=\"app.css\">\n</head>\n<body>\n<script src=\"app.js\"></script>\n</body>\n</html>\n";
    ensureParentDirExists(outFile);
    fs.writeFileSync(outFile, result, { encoding: "utf8" });
}
function fatalError(message) {
    console.error(message + "\nUsage:\nGenerate a single metadata JSON file\n  node " + path.basename(process.argv[1]) + " generate modulePath functionName outputFile\n  e.g. \"generate content/default-content getContent build/out/default-content.json\"\nGenerate all metadata files assuming standard locations:\n  node " + path.basename(process.argv[1]) + " generate-all script-folder output-folder");
    process.exit(1);
}
function ensureParentDirExists(file) {
    var dirName = path.dirname(file);
    if (!fs.existsSync(dirName)) {
        ensureParentDirExists(dirName);
        fs.mkdirSync(dirName);
    }
}

/// <reference path="../../typings/index.d.ts" />
"use strict";
var fs = require("fs");
var utils_1 = require("./utils");
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    name: "write-app-html",
    doc: "Generate an HTML file that includes a JS and CSS file.",
    args: [
        {
            name: "OUT_FILE",
            doc: "The path to write the HTML file to"
        },
        {
            name: "JS_FILE",
            doc: "The relative path from OUT_FILE to the app's JavaScript file, e.g. \"app.js\"."
        },
        {
            name: "CSS_FILE",
            doc: "The relative path from OUT_FILE to the app's CSS file, e.g. \"app.css\"."
        }
    ],
    func: writeAppHtmlCommand,
};
function writeAppHtmlCommand(outFile, jsFile, cssFile) {
    var result = "\n<html>\n<head>\n    <meta charset=\"UTF-8\">\n    <script>\n    var appStyle = document.createElement(\"link\");\n    appStyle.setAttribute(\"rel\", \"stylesheet\");\n    appStyle.setAttribute(\"type\", \"text/css\");\n    appStyle.setAttribute(\"href\", " + JSON.stringify(cssFile) + " + document.location.search);\n    document.head.appendChild(appStyle);\n    </script>\n</head>\n<body>\n<script>\nvar appScript = document.createElement(\"script\");\nappScript.setAttribute(\"src\", " + JSON.stringify(jsFile) + " + document.location.search);\ndocument.body.appendChild(appScript);\n</script>\n</body>\n</html>\n";
    utils_1.ensureParentDirExists(outFile);
    fs.writeFileSync(outFile, result, { encoding: "utf8" });
}

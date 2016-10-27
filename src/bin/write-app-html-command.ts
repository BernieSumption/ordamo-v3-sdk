
/// <reference path="../../typings/index.d.ts" />

import * as fs from "fs";
import {ensureParentDirExists, Command} from "./utils";

export default {
  name: "write-app-html",
  doc: `Generate an HTML file that includes a JS and CSS file.`,
  args: [
    {
      name: "OUT_FILE",
      doc: `The path to write the HTML file to`
    },
    {
      name: "JS_FILE",
      doc: `The relative path from OUT_FILE to the app's JavaScript file, e.g. "app.js".`
    },
    {
      name: "CSS_FILE",
      doc: `The relative path from OUT_FILE to the app's CSS file, e.g. "app.css".`
    }
  ],
  func: writeAppHtmlCommand,
} as Command;

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

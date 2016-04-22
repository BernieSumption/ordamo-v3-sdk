"use strict";
// This is a utility script used by ordamo-v3-sdk-demo-app and other SDK apps using the same template.
// Usage:
// node concat-dist-build.js js_path css_path output_file
// It creates an HTML file that embeds the content of the JS and CSS files

let fs = require("fs");

let jsFile = process.argv[2];
let jsContent = fs.readFileSync(jsFile, "utf8");
let cssFile = process.argv[3];
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

fs.writeFileSync(process.argv[4], result, {encoding: "utf8"});

/// <reference path="../../typings/index.d.ts" />
"use strict";
var path = require("path");
var fs = require("fs");
var rimraf = require("rimraf");
var sdk = require("../index");
var utils_1 = require("./utils");
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
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
            doc: "Optional, defaults to OUTPUT_FOLDER. The folder containing the app's static assets, used to verify that the files referenced by metadata.ts and default-content.ts exist.",
            optional: true
        }
    ],
    doc: "Generate all content and metadata files.",
    func: buildContentCOmmand,
};
function buildContentCOmmand(contentSourceFolder, buildFolder, assetsFolder) {
    if (assetsFolder === void 0) { assetsFolder = buildFolder; }
    var IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif"];
    var VIDEO_EXTENSIONS = ["mp4", "ogv", "webm"];
    process.once("exit", cleanup);
    var contentSchema = getModuleDefaultOutput("content-schema");
    writeJSONFile(contentSchema, "content-schema");
    var defaultContent = getModuleDefaultOutput("default-content");
    validateDefaultContent(contentSchema, defaultContent);
    writeJSONFile(defaultContent, "default-content");
    var appPackageJson = getAppPackageJSON(contentSourceFolder);
    var metadata = getModuleDefaultOutput("metadata");
    var keymap = {
        "id": "name",
        "description": "description",
        "version": "version"
    };
    for (var prop in keymap) {
        if (metadata[prop] === sdk.AUTO_METADATA) {
            metadata[prop] = appPackageJson[keymap[prop]];
        }
    }
    writeJSONFile(metadata, "metadata");
    validateImage(metadata.defaultIconSrc, "metadata.defaultIconSrc", false);
    validateMenuNodes(metadata.menuNodes, "metadata.menuNodes");
    var tmpDir = path.join(process.cwd(), "tmp");
    var tsRequireDir = path.join(tmpDir, "tsreq");
    function cleanup() {
        if (fs.existsSync(tsRequireDir)) {
            rimraf.sync(tsRequireDir);
            try {
                fs.rmdirSync(tmpDir);
            }
            catch (e) {
            }
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
                utils_1.fatalError("Schema contains item \"" + key + " that is missing from the content.");
            }
            var schemaItem = schema[key];
            if (schemaItem.type === "image") {
                validateType([content[key]], "string", "a relative file path", key);
                validateImage(content[key], "content." + key, schemaItem.isVideo);
            }
            if (schemaItem.type === "text") {
                validateType([content[key]], "string", "a string", key);
            }
            if (schemaItem.type === "number") {
                validateType([content[key]], "number", "a number", key);
            }
            if (schemaItem.type === "list") {
                if (!Array.isArray(content[key])) {
                    utils_1.fatalError("Expected content." + key + " to be an array, but it is a " + typeof content[key]);
                }
                else {
                    if (schemaItem.items.type === "image") {
                        validateType(content[key], "string", "an array of relative file paths", key);
                        content[key].forEach(function (path, i) { return validateImage(path, "content." + key + "[" + i + "]", schemaItem.items.isVideo); });
                    }
                    if (schemaItem.items.type === "text") {
                        validateType(content[key], "string", "an array of strings", key);
                    }
                    if (schemaItem.items.type === "number") {
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
                utils_1.fatalError("Content contains item \"" + key + "\" that doesn't exist in the schema.");
            }
        }
        return content;
        function validateType(items, expectedType, expectedTypeHuman, key) {
            for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
                var item = items_1[_i];
                if (typeof item !== expectedType) {
                    utils_1.fatalError("Expected content." + key + " to be " + expectedTypeHuman + ", but it contains a " + typeof item);
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
        validateImage(node.iconSrc, propName + ".iconSrc", false);
        validateMenuNodes(node.children, propName + ".children");
    }
    function validateImage(imagePath, propName, isVideo) {
        var source = path.resolve(assetsFolder, imagePath);
        if (!fs.existsSync(source)) {
            utils_1.fatalError("File \"" + source + "\" is referenced by " + propName + " but does not exist.");
        }
        var extensions = isVideo ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
        var extension = source.replace(/^[^\.]*\./, "").toLowerCase();
        if (extensions.indexOf(extension) === -1) {
            utils_1.fatalError("File \"" + source + "\" referenced by " + propName + " is th wrong type; supported extensions are: " + extensions.join(", "));
        }
    }
    function getModuleDefaultOutput(type) {
        var modulePath = path.resolve(contentSourceFolder, type);
        var mod = require(path.resolve(modulePath));
        if (!mod.default) {
            utils_1.fatalError("Module at " + path.join(contentSourceFolder, type) + " has no default export.");
        }
        return mod.default();
    }
    function writeJSONFile(content, type) {
        var encoded = JSON.stringify(content, null, "  ");
        var outputFile = path.resolve(buildFolder, type + ".json");
        outputFile = path.resolve(outputFile);
        utils_1.ensureParentDirExists(outputFile);
        fs.writeFileSync(outputFile, encoded, { encoding: "utf8" });
        console.log("Wrote output of " + type + ".ts to \"" + nicePath(outputFile) + "\"");
    }
}
exports.buildContentCOmmand = buildContentCOmmand;
function nicePath(p) {
    p = p.replace(path.resolve("."), "");
    if (p[0] === path.sep) {
        p = p.slice(1);
    }
    return p;
}

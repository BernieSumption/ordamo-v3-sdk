"use strict";
var RUNNING_MODE;
if (typeof window === "undefined") {
    RUNNING_MODE = 3 /* UNIT_TESTS */;
}
else if (window === top) {
    RUNNING_MODE = 2 /* DEVELOPMENT */;
}
else {
    RUNNING_MODE = 1 /* HOSTED */;
}
var INSTANCE_CREATED = false;
var EMPTY_DATA_URI = "data:text/plain;charset=utf-8,";
/**
 * Return the SDK running mode, useful for distinguishing between test and live
 */
function getRunningMode() {
    return RUNNING_MODE;
}
exports.getRunningMode = getRunningMode;
/**
 * The main class of the SDK. Your app is responsible for creating a single instance.
 */
var OrdamoSDK = (function () {
    /**
     * When the OrdamoSDK instance is created it will communicate with the host application to
     * request the app's layout and content (or in development mode, use a mock layout and
     * load content from mockcontent.json).
     *
     * @param _initAppCallback a function to be called when data loading is complete and the
     *        app may begin rendering itself based on the layout and content.
     *
     * @param content If provided, the SDK will use this object as content instead of loading
     *        content from the host application.
     */
    function OrdamoSDK(_initAppCallback, _providedContent) {
        this._initAppCallback = _initAppCallback;
        this._providedContent = _providedContent;
        this._sentReadyEvent = false;
        if (RUNNING_MODE === 2 /* DEVELOPMENT */) {
            console.log("OrdamoSDK running in development mode.");
        }
        if (INSTANCE_CREATED && RUNNING_MODE !== 3 /* UNIT_TESTS */) {
            throw new Error("Only one instance of OrdamoSDK may be created per application " + RUNNING_MODE);
        }
        INSTANCE_CREATED = true;
        if (RUNNING_MODE === 2 /* DEVELOPMENT */) {
            this.loadMockContentFile(this._acceptMockContent.bind(this));
        }
        else if (RUNNING_MODE === 1 /* HOSTED */) {
            window.addEventListener("message", this._handleParentMessage.bind(this));
            parent.postMessage({ eventType: "load" }, "*");
        }
    }
    /**
     * This must be called once only after the app has rendered itself
     * and it is safe to display. The app will be hidden until this is
     */
    OrdamoSDK.prototype.notifyAppIsReady = function () {
        if (!this._initMessage) {
            throw new Error("Illegal call to notifyAppIsReady() before init callback has fired.");
        }
        if (!this._sentReadyEvent) {
            this._sentReadyEvent = true;
            if (RUNNING_MODE === 1 /* HOSTED */) {
                parent.postMessage({ eventType: "ready" }, "*");
            }
        }
    };
    /**
     * Return a list of the file objects provided with this app's content
     */
    OrdamoSDK.prototype.getFiles = function () {
        this._checkContentLoaded();
        return this._content.files;
    };
    /**
     * Return a list of the file objects provided with this app's content.
     *
     * If the id does not exist, log an error and return an empty file. This behaviour
     * allows missing images to result in visual defects rather than application crashes.
     */
    OrdamoSDK.prototype.getFile = function (id) {
        this._checkContentLoaded();
        if (this._filesById[id]) {
            return this._filesById[id];
        }
        else {
            console.error("File \"" + id + "\" does not exist, returning an empty file.");
            return {
                id: id,
                data: EMPTY_DATA_URI
            };
        }
    };
    /**
     * Return a list of the file objects provided with this app's content
     */
    OrdamoSDK.prototype.getData = function () {
        this._checkContentLoaded();
        return this._content.data;
    };
    /**
     * Return the init message provided by the host applicatio, which includes
     * layout information
     */
    OrdamoSDK.prototype.getInitMessage = function () {
        this._checkContentLoaded();
        return JSON.parse(JSON.stringify(this._initMessage));
    };
    /**
     * Request that the host application closes this app and returns to the default app.
     */
    OrdamoSDK.prototype.requestAppClose = function () {
        if (RUNNING_MODE === 1 /* HOSTED */) {
            parent.postMessage({ eventType: "close" }, "*");
        }
        else if (RUNNING_MODE === 2 /* DEVELOPMENT */) {
            document.body.style.transition = "opacity 1s, visibility 0s linear 1s";
            document.body.style.opacity = "0";
            document.body.style.visibility = "hidden";
            console.log("The app has been closed. In a hosted application, the user would now be seeing the main menu.");
        }
    };
    /**
     * Set a "font-size: XXXpx" style property on the root element of the document (i.e. <html>)
     * so that the width of the plate spots are a known number of CSS rem units.
     *
     * For example, if your app graphic design has the plate spots at 500px wide, call
     * `setRemUnitDiameterOfPlateSpot(500) and then use "rem" units instead of "px",
     * e.g. "width: 250rem" to make an element half the width of the plate spot.
     *
     * This allows you to create a plate spot UI that scales perfectly to the actual
     * plate spot size, and is more reliable than using a CSS transform for scaling.
     */
    OrdamoSDK.prototype.setRemUnitDiameterOfPlateSpot = function (plateSpotRemWidth) {
        this._checkContentLoaded();
        var plateSpot = this._initMessage.plateSpots[0];
        if (plateSpot) {
            document.documentElement.style.fontSize = (plateSpot.radius * 2 / plateSpotRemWidth) + "px";
        }
    };
    //
    // PRIVATE STUFF
    //
    OrdamoSDK.prototype._handleParentMessage = function (event) {
        var message = event.data;
        if (message.eventType === "init") {
            if (this._initMessage) {
                console.error("Second init message sent, ignoring");
            }
            else {
                var duckMessage = message;
                if (duckMessage.shapes && !duckMessage.plateSpots) {
                    // compatibility with older API servers that called "plateSpots" "shapes"
                    duckMessage.plateSpots = duckMessage.shapes;
                }
                this._initMessage = message;
                this._acceptContent(this._providedContent || { files: [], data: null });
                this._initAppCallback();
            }
        }
        if (message.eventType === "navigate" && this.onNavigate) {
            this.onNavigate(message.navigateButtonId);
        }
    };
    OrdamoSDK.prototype.loadMockContentFile = function (successCallback, failureCallback) {
        var _this = this;
        if (this._providedContent) {
            setTimeout(function () { return successCallback(_this._providedContent); }, 1);
        }
        else {
            var MOCK_CONTENT_FILE_1 = "mockcontent.json";
            var xhr_1 = new XMLHttpRequest();
            xhr_1.open("GET", MOCK_CONTENT_FILE_1, true);
            xhr_1.onreadystatechange = function () {
                if (xhr_1.readyState === 4) {
                    if (xhr_1.status === 200) {
                        var mockContent = void 0;
                        try {
                            mockContent = JSON.parse(xhr_1.responseText);
                        }
                        catch (e) {
                            console.error(MOCK_CONTENT_FILE_1 + " is not a valid JSON file, check the console for more info");
                            console.error(e);
                            console.log(xhr_1.responseText);
                        }
                        successCallback(mockContent);
                    }
                    else {
                        if (failureCallback) {
                            failureCallback();
                        }
                        else {
                            console.error("Failed to load \"" + MOCK_CONTENT_FILE_1 + "\", is the development server running (npm start)");
                        }
                    }
                }
            };
            xhr_1.send();
        }
    };
    OrdamoSDK.prototype._acceptMockContent = function (mockContent) {
        var _this = this;
        if (this._content) {
            throw new Error("Mock data file already loaded.");
        }
        this._acceptContent(mockContent);
        this._initMessage = makeMockInitMessage();
        var seconds = 5;
        setTimeout(function () {
            if (!_this._sentReadyEvent) {
                console.error("WARNING: this app is taking too long to be ready. It should call notifyAppIsReady() as soon as it is rendered.");
            }
        }, seconds * 1000);
        this._initAppCallback();
    };
    OrdamoSDK.prototype._checkContentLoaded = function () {
        if (!this._content) {
            throw new Error("Content has not been loaded yet.");
        }
    };
    OrdamoSDK.prototype._acceptContent = function (content) {
        this._content = content;
        this._filesById = {};
        for (var _i = 0, _a = this._content.files; _i < _a.length; _i++) {
            var file = _a[_i];
            this._filesById[file.id] = file;
        }
    };
    return OrdamoSDK;
}());
exports.OrdamoSDK = OrdamoSDK;
function makeMockInitMessage() {
    var queryParams = {};
    document.location.href.replace(/[?&]([^=]+)=([^&]*)?/g, function (match, name, value) { return queryParams[name] = parseInt(value); });
    if (queryParams["rotation"] % 90) {
        console.error("You have set rotation=" + queryParams["rotation"] + " - the SDK only supports rotations that are a multiple of 90 degrees");
        queryParams["rotation"] = Math.round(queryParams["rotation"] / 90) * 90;
    }
    var numPlateSpots = isNaN(queryParams["plateSpots"]) ? 2 : queryParams["plateSpots"], numContentAreas = isNaN(queryParams["contentAreas"]) ? 1 : queryParams["contentAreas"], width = window.innerWidth, height = window.innerHeight, padding = 20, columns = Math.min(3, numPlateSpots + numContentAreas), rows = Math.ceil((numPlateSpots + numContentAreas) / columns), radius = Math.min((width - padding * (columns + 1)) / columns, (height - padding * (rows + 1)) / rows) / 2, size = padding + radius * 2;
    console.log("Making mock layout with " + numPlateSpots + " plate spots and " + numContentAreas + " content areas. Control the layout with URL parameters like so: ?plateSpots=4&contentAreas=2&rotation=0");
    var item = 0, column = 0, row = 0, x = 0, y = 0, rotation = queryParams["rotation"];
    return {
        "eventType": "init",
        "widthPx": width,
        "heightPx": width,
        "resolutionPixelsPerCm": 12,
        "plateSpots": layout(numPlateSpots, function () {
            return {
                "type": "circle",
                "id": item,
                "x": x,
                "y": y,
                "radius": radius,
                "rotationDegrees": rotation,
                "borderWidth": radius / 10
            };
        }),
        "contentAreas": layout(numContentAreas, function () {
            return {
                "type": "rectangle",
                "id": item,
                "x": x,
                "y": y,
                "width": radius * 2,
                "height": radius * 2,
                "rotationDegrees": rotation
            };
        })
    };
    function layout(n, f) {
        var results = [];
        for (var i = 0; i < n; i++) {
            x = padding + radius + size * (item % columns);
            y = padding + radius + size * Math.floor(item / columns);
            if (isNaN(queryParams["rotation"])) {
                rotation = item * 90;
            }
            results.push(f());
            item++;
        }
        return results;
    }
}

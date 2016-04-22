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
var MAX_SAVED_STATE_SECONDS = 10 * 60;
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
     * load content from default-content.json).
     *
     * @param _contentSchema
     *
     * @param _initAppCallback
     */
    function OrdamoSDK(_options) {
        this._options = _options;
        this._sentReadyEvent = false;
        this._savedState = null;
        if (RUNNING_MODE === 2 /* DEVELOPMENT */) {
            logNotice("running in development mode.");
            logNotice("Emulating touch events.");
            startTouchEmulation();
            var chromeVersion = /\bChrome\/(\d+)/.exec(navigator.userAgent);
            if (!(chromeVersion && parseInt(chromeVersion[1]) >= 46)) {
                alert("Sorry, Ordamo V3 apps require a recent version of Google Chrome to run. Please load this app in Chrome, and/or ensure that your copy of Chrome is up to date.");
                throw new Error("Bad browser: " + navigator.userAgent);
            }
        }
        if (INSTANCE_CREATED && RUNNING_MODE !== 3 /* UNIT_TESTS */) {
            throw new Error("Only one instance of OrdamoSDK may be created per application " + RUNNING_MODE);
        }
        INSTANCE_CREATED = true;
        if (RUNNING_MODE === 2 /* DEVELOPMENT */) {
            this._initialiseDevelopmentData();
        }
        else if (RUNNING_MODE === 1 /* HOSTED */) {
            window.addEventListener("message", this._handleParentMessage.bind(this));
            parent.postMessage({ eventType: "load" }, "*");
        }
        this._restoreState();
    }
    OrdamoSDK.prototype._getSavedStateKey = function () {
        return "ordamo-sdk-content-" + document.location.pathname;
    };
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
    OrdamoSDK.prototype.getContent = function () {
        this._requireInitMessage();
        return this._initMessage.content;
    };
    OrdamoSDK.prototype.getLayout = function () {
        this._requireInitMessage();
        return this._initMessage.layout;
    };
    /**
     * Return the saved state as created by the saveStateCallback constructor option last
     * time the application quit.
     *
     * WARNING: restoring saved state is a common source of application errors, especially
     * just after an application update when the saved state was created by the previous
     * version of the application. Validate that the state meets your expectations and wrap
     * your restoration code in a try/catch block.
     */
    OrdamoSDK.prototype.getSavedState = function () {
        this._requireInitMessage();
        return this._savedState;
    };
    /**
     * Request that the host application closes this app and returns to the default app.
     */
    OrdamoSDK.prototype.requestAppClose = function () {
        this._requireInitMessage();
        if (RUNNING_MODE === 1 /* HOSTED */) {
            parent.postMessage({ eventType: "close" }, "*");
        }
        else if (RUNNING_MODE === 2 /* DEVELOPMENT */) {
            document.body.style.transition = "opacity 1s, visibility 0s linear 1s";
            document.body.style.opacity = "0";
            document.body.style.visibility = "hidden";
            logNotice("The app has been closed. In a hosted application, the user would now be seeing the main menu.");
        }
        if (this._options.saveStateCallback) {
            this._saveState();
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
        this._requireInitMessage();
        var plateSpot = this._initMessage.layout.plateSpots[0];
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
                this._receiveInitMessage(message);
            }
        }
        if (message.eventType === "navigate" && this.onNavigate) {
            this.onNavigate(message.navigateButtonId);
        }
    };
    OrdamoSDK.prototype._initialiseDevelopmentData = function () {
        var _this = this;
        var DEFAULT_CONTENT_FILE = "default-content.json";
        var xhr = new XMLHttpRequest();
        xhr.open("GET", DEFAULT_CONTENT_FILE, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var content = void 0;
                    try {
                        content = JSON.parse(xhr.responseText);
                    }
                    catch (e) {
                        console.error(DEFAULT_CONTENT_FILE + " is not a valid JSON file, check the console for more info");
                        console.error(e);
                        logNotice("This content is not JSON", xhr.responseText);
                    }
                    if (content) {
                        _this._receiveInitMessage({
                            eventType: "init",
                            content: content,
                            layout: makeMockLayout()
                        });
                        var TIMEOUT_SECONDS_1 = 5;
                        setTimeout(function () {
                            if (!_this._sentReadyEvent) {
                                console.error("WARNING: this app is taking too long to be ready. It should render in less than " + TIMEOUT_SECONDS_1 + " seconds then call notifyAppIsReady().");
                            }
                        }, TIMEOUT_SECONDS_1 * 1000);
                    }
                }
                else {
                    console.error("Failed to load \"" + DEFAULT_CONTENT_FILE + "\", is the development server running (npm start)");
                }
            }
        };
        xhr.send();
    };
    OrdamoSDK.prototype._requireInitMessage = function () {
        if (!this._initMessage) {
            throw new Error("The SDK has not initialised yet.");
        }
    };
    OrdamoSDK.prototype._receiveInitMessage = function (message) {
        if (this._initMessage) {
            logError("Duplicate init message received, ignoring");
            return;
        }
        this._initMessage = message;
        if (this._options.initCallback) {
            this._options.initCallback();
        }
    };
    OrdamoSDK.prototype._saveState = function () {
        if (this._options.saveStateCallback) {
            var storedForm = {
                timestamp: Date.now(),
                state: this._options.saveStateCallback()
            };
            sessionStorage.setItem(this._getSavedStateKey(), JSON.stringify(storedForm));
        }
    };
    OrdamoSDK.prototype._restoreState = function () {
        var storedForm = sessionStorage.getItem(this._getSavedStateKey());
        if (storedForm) {
            try {
                var save = JSON.parse(storedForm);
                if (Date.now() - save.timestamp < MAX_SAVED_STATE_SECONDS * 1000) {
                    this._savedState = save.state;
                }
                else {
                    logNotice("Ignoring saved state older than " + MAX_SAVED_STATE_SECONDS + " seconds.");
                    this._clearState();
                }
            }
            catch (e) {
                console.error("Error parsing save data, wiping saved state", e, storedForm);
                this._clearState();
            }
        }
    };
    OrdamoSDK.prototype._clearState = function () {
        sessionStorage.removeItem(this._getSavedStateKey());
    };
    return OrdamoSDK;
}());
exports.OrdamoSDK = OrdamoSDK;
function logError(message) {
    if (RUNNING_MODE === 1 /* HOSTED */) {
        console.error(message);
    }
    else {
        throw new Error(message);
    }
}
/**
 * Helper function for defining content managed images.
 *
 * This function is typed `string` mecause that's what will be provided by the CMS. However
 * it actually returns an ImageDescriptor object containing instructions for the CMS.
 */
function image(options) {
    var descriptor = {
        type: "image",
        options: options
    };
    return descriptor;
}
exports.image = image;
/**
 * Helper function for defining lists of content managed items.
 *
 * This function is typed `T[]` where `T` is e.g. `string` in the case of images, because
 * that's what will be provided by the CMS. However it actually returns an ListDescriptor
 * object containing instructions for the CMS.
 */
function list(options) {
    var itemDescriptor = options.items;
    if (typeof itemDescriptor.type !== "string") {
        throw new Error("items must be a content descriptor, e.g. as returned by sdk.image()");
    }
    var descriptor = {
        type: "list",
        min: options.min,
        max: options.max,
        items: itemDescriptor
    };
    return descriptor;
}
exports.list = list;
//
// DEVELOPMENT UTILITIES
//
function logNotice(message) {
    var additional = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        additional[_i - 1] = arguments[_i];
    }
    console.log.apply(console, ["Ordamo SDK: " + message].concat(additional));
}
function makeMockLayout() {
    var queryParams = {};
    document.location.href.replace(/[?&]([^=]+)=([^&]*)?/g, function (match, name, value) { return queryParams[name] = parseInt(value); });
    if (queryParams["rotation"] % 90) {
        console.error("You have set rotation=" + queryParams["rotation"] + " - the SDK only supports rotations that are a multiple of 90 degrees");
        queryParams["rotation"] = Math.round(queryParams["rotation"] / 90) * 90;
    }
    var numPlateSpots = isNaN(queryParams["plateSpots"]) ? 2 : queryParams["plateSpots"], numContentAreas = isNaN(queryParams["contentAreas"]) ? 1 : queryParams["contentAreas"], clearCentreSpace = queryParams["avoidCentre"] ? 1 : 0, width = window.innerWidth, height = window.innerHeight, padding = 20, columns = Math.min(3, numPlateSpots + numContentAreas + clearCentreSpace), rows = Math.ceil((numPlateSpots + numContentAreas + clearCentreSpace) / columns), radius = Math.min((width - padding * (columns + 1)) / columns, (height - padding * (rows + 1)) / rows) / 2, size = padding + radius * 2;
    logNotice("Making mock layout with " + numPlateSpots + " plate spots and " + numContentAreas + " content areas" + (clearCentreSpace ? " and keeping the centre clear" : "") + ". Control the layout with URL parameters like so: ?plateSpots=4&contentAreas=2&rotation=0&avoidCentre=1");
    var item = 0, itemOffset = 0, column = 0, row = 0, x = 0, y = 0, rotation = queryParams["rotation"];
    return {
        "widthPx": width,
        "heightPx": width,
        "resolutionPixelsPerCm": 12,
        "plateSpots": flowLayout(numPlateSpots, function () {
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
        "contentAreas": flowLayout(numContentAreas, function () {
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
    function flowLayout(itemCount, itemFactory) {
        var results = [];
        for (var i = 0; i < itemCount; i++) {
            computeXY();
            if (clearCentreSpace) {
                var dx = (window.innerWidth / 2 - x);
                var dy = (window.innerHeight / 2 - y);
                var centreDistance = Math.sqrt(dx * dx + dy * dy);
                if (centreDistance < radius) {
                    itemOffset++;
                    computeXY();
                }
            }
            if (isNaN(queryParams["rotation"])) {
                rotation = item * 90;
            }
            results.push(itemFactory());
            item++;
        }
        return results;
    }
    function computeXY() {
        x = padding + radius + size * ((item + itemOffset) % columns);
        y = padding + radius + size * Math.floor((item + itemOffset) / columns);
    }
}
/**
 * Supresses mouse events and convert them to touch events
 */
function startTouchEmulation() {
    var currentElement;
    var hasNativeTouchEvents = false;
    window.addEventListener("touchstart", checkForNativeEvent, true);
    window.addEventListener("mousedown", handleMouseEvent("touchstart"), true);
    window.addEventListener("mousemove", handleMouseEvent("touchmove"), true);
    window.addEventListener("mouseup", handleMouseEvent("touchend"), true);
    window.addEventListener("click", killEventDead, true);
    window.addEventListener("mouseenter", killEventDead, true);
    window.addEventListener("mouseleave", killEventDead, true);
    window.addEventListener("mouseout", killEventDead, true);
    window.addEventListener("mouseover", killEventDead, true);
    function killEventDead(event) {
        event.preventDefault();
        event.stopPropagation();
    }
    function handleMouseEvent(touchType) {
        return function (mouseEvent) {
            if (mouseEvent.target.nodeName !== "INPUT") {
                killEventDead(mouseEvent);
                if (mouseEvent.button !== 0 || hasNativeTouchEvents) {
                    return;
                }
                if (mouseEvent.type === "mousedown") {
                    currentElement = mouseEvent.target;
                    if (currentElement.nodeType !== Node.ELEMENT_NODE) {
                        currentElement = currentElement.parentElement;
                    }
                }
                if (!currentElement) {
                    return;
                }
                var touch = new Touch({
                    identifier: 1,
                    target: currentElement,
                    clientX: mouseEvent.clientX,
                    clientY: mouseEvent.clientY,
                    pageX: mouseEvent.pageX,
                    pageXY: mouseEvent.pageY,
                    screenX: mouseEvent.screenX,
                    screenY: mouseEvent.screenY,
                });
                var touchEvent = new TouchEvent(touchType, {
                    touches: mouseEvent.type === "mouseup" ? [] : [touch],
                    targetTouches: mouseEvent.type === "mouseup" ? [] : [touch],
                    changedTouches: [touch],
                    ctrlKey: mouseEvent.ctrlKey,
                    shiftKey: mouseEvent.shiftKey,
                    altKey: mouseEvent.altKey,
                    metaKey: mouseEvent.metaKey,
                    bubbles: true,
                    cancelable: true
                });
                currentElement.dispatchEvent(touchEvent);
            }
            if (mouseEvent.type === "mouseup") {
                currentElement = null;
            }
        };
    }
    function checkForNativeEvent(e) {
        if (e.isTrusted) {
            window.removeEventListener("touchstart", checkForNativeEvent, true);
            hasNativeTouchEvents = true;
        }
    }
}

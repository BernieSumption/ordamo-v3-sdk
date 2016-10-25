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
    function OrdamoSDK(options) {
        this._sentReadyEvent = false;
        this._savedState = null;
        if (INSTANCE_CREATED && RUNNING_MODE !== 3 /* UNIT_TESTS */) {
            throw new Error("Only one instance of OrdamoSDK may be created per application " + RUNNING_MODE);
        }
        INSTANCE_CREATED = true;
        this.onInteractions = options.onInteractions;
        this.onNavigate = options.onNavigate;
        this._contentSchema = options.contentSchema;
        this._initCallback = options.initCallback;
        this._saveStateCallback = options.saveStateCallback;
        this._fullscreen = options.fullscreen;
        if (RUNNING_MODE === 2 /* DEVELOPMENT */) {
            this._initialiseDevelopmentMode();
        }
        else if (RUNNING_MODE === 1 /* HOSTED */) {
            this._initialiseHostedMode();
        }
        if (RUNNING_MODE !== 3 /* UNIT_TESTS */) {
            this._startTouchEmulation();
        }
    }
    OrdamoSDK.prototype._getSavedStateKey = function () {
        return "ordamo-sdk-content-" + document.location.pathname;
    };
    /**
     * This must be called once only after the app has rendered itself
     * and it is safe to display. The app will be hidden until this is called, preventing the user
     * from seeing e.g. half-loaded content.
     */
    OrdamoSDK.prototype.notifyAppIsReady = function () {
        if (!this._initMessage) {
            throw new Error("Illegal call to notifyAppIsReady() before init callback has fired.");
        }
        if (!this._sentReadyEvent) {
            this._sentReadyEvent = true;
            if (RUNNING_MODE === 1 /* HOSTED */) {
                this._sendParentMessage({ eventType: "ready" });
            }
        }
    };
    /**
     * Return the content that the app should render. If specific content has been created using
     * the CMS, that content will be provided through this method, otherwise the default content
     * from default-content.json will be returned.
     */
    OrdamoSDK.prototype.getContent = function () {
        this._requireInitMessage();
        return this._content;
    };
    /**
     * Get the table's current layout. Each restaurant table may be a different physical size with
     * a different number and position of plates.
     */
    OrdamoSDK.prototype.getLayout = function () {
        this._requireInitMessage();
        return this._initMessage.layout;
    };
    /**
     * Return the table label provided by the apphost.
     *
     * See InitMessage.table for format information.
     */
    OrdamoSDK.prototype.getTableLabel = function () {
        this._requireInitMessage();
        return this._initMessage.table;
    };
    /**
     * Return the requiredWidth value from the app's metadata, or undefined if no requiredWidth is set
     */
    OrdamoSDK.prototype.getRequiredWidth = function () {
        this._requireInitMessage();
        return this._initMessage.requiredWidth;
    };
    /**
     * Return the requiredHeight value from the app's metadata, or undefined if no requiredHeight is set
     */
    OrdamoSDK.prototype.getRequiredHeight = function () {
        this._requireInitMessage();
        return this._initMessage.requiredHeight;
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
        if (RUNNING_MODE === 1 /* HOSTED */) {
            this._sendParentMessage({ eventType: "close" });
        }
        else if (RUNNING_MODE === 2 /* DEVELOPMENT */) {
            document.body.style.transition = "opacity 1s, background 1s, visibility 0s linear 1s";
            document.body.style.opacity = "0";
            document.documentElement.style.background = "#FFF"; // <html> needs a background, or <body>'s one will display even if its hidden
            document.body.style.visibility = "hidden";
            logNotice("The app has been closed. In a hosted application, the user would now be seeing the main menu.");
        }
        if (this._saveStateCallback) {
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
                this._receiveInitMessage(message);
            }
        }
        if (message.eventType === "interactions" && this.onInteractions) {
            this.onInteractions(message);
        }
        if (message.eventType === "navigate" && this.onNavigate) {
            this.onNavigate(message);
        }
    };
    OrdamoSDK.prototype._initialiseHostedMode = function () {
        window.addEventListener("message", this._handleParentMessage.bind(this));
        var loadMessage = {
            eventType: "load",
            fullscreen: !!this._fullscreen
        };
        this._sendParentMessage(loadMessage);
    };
    OrdamoSDK.prototype._sendParentMessage = function (message) {
        parent.postMessage(message, "*");
    };
    OrdamoSDK.prototype._initialiseDevelopmentMode = function () {
        logNotice("running in development mode.");
        var chromeVersion = /\bChrome\/(\d+)/.exec(navigator.userAgent);
        if (!(chromeVersion && parseInt(chromeVersion[1]) >= 46)) {
            alert("Sorry, Ordamo V3 apps require a recent version of Google Chrome to run. Please load this app in Chrome, and/or ensure that your copy of Chrome is up to date.");
            throw new Error("Bad browser: " + navigator.userAgent);
        }
        var mockLayout = makeMockLayout();
        this._receiveInitMessage({
            eventType: "init",
            content: null,
            layout: mockLayout,
            table: "1",
            version: "0." + Math.round(Math.random() * 99999) + "-MOCKVERSION-SDK-DEVMODE",
            sessionId: 1,
            requiredWidth: 800,
            requiredHeight: 600,
        });
        if (document.location.search.match(/\bmanualFullscreen=true/)) {
            var goFullscreen = function () {
                if (document.webkitFullscreenEnabled && !document.webkitFullscreenElement) {
                    document.body.webkitRequestFullScreen();
                }
            };
            document.body.addEventListener("click", goFullscreen);
            document.body.addEventListener("touchstart", goFullscreen);
        }
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
        this._restoreState();
        if (message.content || !this._contentSchema) {
            this._finishInitialisation();
        }
        else {
            this._loadDefaultContentFile();
        }
    };
    OrdamoSDK.prototype._finishInitialisation = function () {
        var _this = this;
        if (this._contentSchema) {
            this._content = JSON.parse(JSON.stringify(this._contentSchema));
            for (var prop in this._content) {
                this._content[prop].value = this._initMessage.content[prop];
            }
        }
        if (this._initCallback) {
            this._initCallback();
        }
        var TIMEOUT_SECONDS = 5;
        setTimeout(function () {
            if (!_this._sentReadyEvent) {
                console.error("WARNING: this app is taking too long to be ready. It should render in less than " + TIMEOUT_SECONDS + " seconds then call notifyAppIsReady().");
            }
        }, TIMEOUT_SECONDS * 1000);
    };
    OrdamoSDK.prototype._loadDefaultContentFile = function () {
        var _this = this;
        var DEFAULT_CONTENT_FILE = "default-content.json?version=" + encodeURIComponent(this._initMessage.version);
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
                        _this._initMessage.content = content;
                        _this._finishInitialisation();
                    }
                }
                else {
                    console.error("Failed to load \"" + DEFAULT_CONTENT_FILE + "\", is the development server running (npm start)");
                }
            }
        };
        xhr.send();
    };
    OrdamoSDK.prototype._saveState = function () {
        if (this._saveStateCallback) {
            var storedForm = {
                timestamp: Date.now(),
                state: this._saveStateCallback(),
                appVersion: this._initMessage.version,
                sessionId: this._initMessage.sessionId
            };
            sessionStorage.setItem(this._getSavedStateKey(), JSON.stringify(storedForm));
        }
    };
    OrdamoSDK.prototype._restoreState = function () {
        var storedForm = sessionStorage.getItem(this._getSavedStateKey());
        if (storedForm) {
            try {
                var save = JSON.parse(storedForm);
                if (save.appVersion !== this._initMessage.version) {
                    logNotice("Ignoring saved state, app version has changed from \"" + save.appVersion + "\" to \"" + this._initMessage.version + "\".");
                    this._clearState();
                }
                else if (save.sessionId !== this._initMessage.sessionId) {
                    logNotice("Ignoring saved state, session has changed.");
                    this._clearState();
                }
                else if (Date.now() - save.timestamp > MAX_SAVED_STATE_SECONDS * 1000) {
                    logNotice("Ignoring saved state older than " + MAX_SAVED_STATE_SECONDS + " seconds.");
                    this._clearState();
                }
                else {
                    this._savedState = save.state;
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
    /**
     * Supresses mouse events and convert them to touch events
     */
    OrdamoSDK.prototype._startTouchEmulation = function () {
        var _this = this;
        startTouchEventEmulation();
        if (RUNNING_MODE === 2 /* DEVELOPMENT */ && !this._fullscreen) {
            logNotice("Supressing touch events because this app is not fullscreen. Background apps can use OrdamoSDK.onInteractions instead.");
        }
        var interceptTouchEvent = function (e) {
            if (!_this._fullscreen) {
                e.stopPropagation();
                e.preventDefault();
            }
            if (_this.onInteractions) {
                _this.onInteractions(makeInteractionsMessage([e]));
            }
        };
        document.body.addEventListener("touchstart", interceptTouchEvent, true);
        document.body.addEventListener("touchmove", interceptTouchEvent, true);
        document.body.addEventListener("touchend", interceptTouchEvent, true);
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
 */
function image(options) {
    return Object.assign({ type: "image" }, options);
}
exports.image = image;
/**
 * Helper function for defining content managed text strings.
 */
function text(options) {
    return Object.assign({ type: "text" }, options);
}
exports.text = text;
/**
 * Helper function for defining content managed numbers.
 */
function number(options) {
    return Object.assign({ type: "number" }, options);
}
exports.number = number;
/**
 * Helper function for defining lists of content managed text strings.
 */
function textList(options) {
    options.items = Object.assign({ type: "text" }, options.items);
    return Object.assign({ type: "list" }, options);
}
exports.textList = textList;
/**
 * Helper function for defining lists of content managed images.
 */
function imageList(options) {
    options.items = Object.assign({ type: "image" }, options.items);
    return Object.assign({ type: "list" }, options);
}
exports.imageList = imageList;
/**
 * Helper function for defining lists of content managednumbersimages.
 */
function numberList(options) {
    options.items = Object.assign({ type: "number" }, options.items);
    return Object.assign({ type: "list" }, options);
}
exports.numberList = numberList;
function makeInteractionsMessage(events, originElement) {
    var coords;
    if (originElement) {
        coords = originElement.getBoundingClientRect();
    }
    return {
        eventType: "interactions",
        touchEvents: events.map(function (e) { return makeCrossWindowTouchEvent(e, coords); })
    };
}
exports.makeInteractionsMessage = makeInteractionsMessage;
function makeCrossWindowTouchEvent(touchEvent, originCoords) {
    var touches = Array.prototype.slice.call(touchEvent.touches);
    var changedTouches = Array.prototype.slice.call(touchEvent.changedTouches);
    return {
        type: touchEvent.type,
        touches: touches.map(function (t) { return makeCrossWindowTouch(t, originCoords); }),
        changedTouches: changedTouches.map(function (t) { return makeCrossWindowTouch(t, originCoords); }),
        altKey: touchEvent.altKey,
        ctrlKey: touchEvent.ctrlKey,
        metaKey: touchEvent.metaKey,
        shiftKey: touchEvent.shiftKey,
    };
}
exports.makeCrossWindowTouchEvent = makeCrossWindowTouchEvent;
function makeCrossWindowTouch(touch, originCoords) {
    var clientX = touch.clientX;
    var clientY = touch.clientY;
    if (originCoords) {
        clientX -= originCoords.left;
        clientY -= originCoords.top;
    }
    return {
        identifier: touch.identifier,
        clientX: clientX,
        clientY: clientY
    };
}
exports.makeCrossWindowTouch = makeCrossWindowTouch;
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
    var numPlateSpots = isNaN(queryParams["plateSpots"]) ? 2 : queryParams["plateSpots"], numContentAreas = isNaN(queryParams["contentAreas"]) ? 1 : queryParams["contentAreas"], clearCentreSpace = queryParams["avoidCentre"] ? 1 : 0, width = window.innerWidth, height = window.innerHeight, resolution = 12, padding = 20, columns = Math.min(3, numPlateSpots + numContentAreas + clearCentreSpace), rows = Math.ceil((numPlateSpots + numContentAreas + clearCentreSpace) / columns), radius = Math.min((width - padding * (columns + 1)) / columns, (height - padding * (rows + 1)) / rows) / 2, size = padding + radius * 2;
    logNotice("Making mock layout " + width + "x" + height + "px (~ " + Math.round(width / resolution) + "x" + Math.round(height / resolution) + "cm) with " + numPlateSpots + " plate spots and " + numContentAreas + " content areas" + (clearCentreSpace ? " and keeping the centre clear" : "") + ". Control the layout with URL parameters like so: ?plateSpots=4&contentAreas=2&rotation=0&avoidCentre=1");
    var item = 0, itemOffset = 0, x = 0, y = 0, rotation = queryParams["rotation"];
    return {
        "widthPx": width,
        "heightPx": height,
        "resolutionPixelsPerCm": resolution,
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
 * Supresses mouse events and convert them to touch events, optionally dispatching
 * the touch events on target DOM elements and/or reporting them through a callback.
 */
function startTouchEventEmulation() {
    var currentElement;
    var hasNativeTouchEvents = false;
    var killEventDead = function (event) {
        event.preventDefault();
        event.stopPropagation();
    };
    var handleMouseEvent = function (touchType) {
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
                    pageY: mouseEvent.pageY,
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
    };
    var checkForNativeEvent = function (e) {
        if (e.isTrusted) {
            window.removeEventListener("touchstart", checkForNativeEvent, true);
            hasNativeTouchEvents = true;
        }
    };
    window.addEventListener("touchstart", checkForNativeEvent, true);
    window.addEventListener("mousedown", handleMouseEvent("touchstart"), true);
    window.addEventListener("mousemove", handleMouseEvent("touchmove"), true);
    window.addEventListener("mouseup", handleMouseEvent("touchend"), true);
    window.addEventListener("click", killEventDead, true);
    window.addEventListener("mouseenter", killEventDead, true);
    window.addEventListener("mouseleave", killEventDead, true);
    window.addEventListener("mouseout", killEventDead, true);
    window.addEventListener("mouseover", killEventDead, true);
}
exports.startTouchEventEmulation = startTouchEventEmulation;

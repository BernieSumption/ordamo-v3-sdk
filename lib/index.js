"use strict";
var ORDAMO_SDK_VERSION = "1.0.0";
var IS_DEVELOPMENT_MODE = window === top;
var INSTANCE_CREATED = false;
var OrdamoSDK = (function () {
    function OrdamoSDK(_initAppCallback) {
        this._initAppCallback = _initAppCallback;
        this._sentReadyEvent = false;
        if (IS_DEVELOPMENT_MODE) {
            console.log("OrdamoSDK running in development mode.");
        }
        if (INSTANCE_CREATED) {
            throw new Error("Only one instance of OrdamoSDK may be created per application");
        }
        INSTANCE_CREATED = true;
        if (IS_DEVELOPMENT_MODE) {
            this.loadMockContentFile(this._acceptMockContent.bind(this));
        }
        else {
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
            if (!IS_DEVELOPMENT_MODE) {
                parent.postMessage({ eventType: "ready" }, "*");
            }
        }
    };
    OrdamoSDK.prototype.getFiles = function () {
        this._checkContentLoaded();
        return this._content.files;
    };
    OrdamoSDK.prototype.getInitMessage = function () {
        return JSON.parse(JSON.stringify(this._initMessage));
    };
    OrdamoSDK.prototype._handleParentMessage = function (event) {
        var message = event.data;
        if (message.eventType === "init") {
            if (this._initMessage) {
                console.error("Second init message provided");
            }
            else {
                this._initMessage = message;
                this._content = { files: [] };
                this._initAppCallback();
            }
        }
        if (message.eventType === "navigate" && this.onNavigate) {
            this.onNavigate(message.navigateButtonId);
        }
    };
    OrdamoSDK.prototype.loadMockContentFile = function (successCallback, failureCallback) {
        var MOCK_CONTENT_FILE = "mockcontent.json";
        var xhr = new XMLHttpRequest();
        xhr.open("GET", MOCK_CONTENT_FILE, true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var mockContent = void 0;
                    try {
                        mockContent = JSON.parse(xhr.responseText);
                    }
                    catch (e) {
                        console.error(MOCK_CONTENT_FILE + " is not a valid JSON file, check the console for more info");
                        console.error(e);
                        console.log(xhr.responseText);
                    }
                    successCallback(mockContent);
                }
                else {
                    if (failureCallback) {
                        failureCallback();
                    }
                    else {
                        console.error("Failed to load \"" + MOCK_CONTENT_FILE + "\", is the development server running (npm start)");
                    }
                }
            }
        };
        xhr.send();
    };
    OrdamoSDK.prototype._acceptMockContent = function (mockContent) {
        var _this = this;
        if (this._content) {
            throw new Error("Mock data file already loaded.");
        }
        this._initMessage = MOCK_INIT_MESSAGE;
        this._content = mockContent;
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
    return OrdamoSDK;
}());
exports.OrdamoSDK = OrdamoSDK;
var MOCK_INIT_MESSAGE = {
    "eventType": "init",
    "widthPx": 1920,
    "heightPx": 1080,
    "resolutionPixelsPerCm": 14,
    "shapes": [
        { "type": "circle", "id": 0, "x": 1104, "y": 308, "radius": 276, "rotationDegrees": 180, "borderWidth": 32 },
        { "type": "circle", "id": 1, "x": 296, "y": 492, "radius": 276, "rotationDegrees": 0, "borderWidth": 32 }
    ],
    "contentAreas": [
        { "type": "rectangle", "id": 0, "x": 741, "y": 640, "width": 247, "height": 240, "rotationDegrees": 0 },
        { "type": "rectangle", "id": 1, "x": 659, "y": 160, "width": 247, "height": 240, "rotationDegrees": 180 }
    ]
};

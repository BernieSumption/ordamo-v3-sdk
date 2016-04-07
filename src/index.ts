"use strict";

const ORDAMO_SDK_VERSION = "1.0.0";

const IS_DEVELOPMENT_MODE = window === top;

let INSTANCE_CREATED = false;

export class OrdamoSDK {

  public onNavigate: (event: string) => void;

  private _content: SDKContent;

  private _initMessage: SDKInitMessage;
  private _sentReadyEvent = false;

  constructor(private _initAppCallback: Function) {
    if (IS_DEVELOPMENT_MODE) {
      console.log("OrdamoSDK running in development mode.");
    }
    if (INSTANCE_CREATED) {
      throw new Error("Only one instance of OrdamoSDK may be created per application");
    }
    INSTANCE_CREATED = true;
    if (IS_DEVELOPMENT_MODE) {
      this.loadMockContentFile(this._acceptMockContent.bind(this));
    } else {
      window.addEventListener("message", this._handleParentMessage.bind(this));
      parent.postMessage({ eventType: "load" }, "*");
    }
  }

  /**
   * This must be called once only after the app has rendered itself
   * and it is safe to display. The app will be hidden until this is
   */
  notifyAppIsReady() {
    if (!this._initMessage) {
      throw new Error("Illegal call to notifyAppIsReady() before init callback has fired.");
    }
    if (!this._sentReadyEvent) {
      this._sentReadyEvent = true;
      if (!IS_DEVELOPMENT_MODE) {
        parent.postMessage({ eventType: "ready" }, "*");
      }
    }
  }

  getFiles() {
    this._checkContentLoaded();
    return this._content.files as SDKFile[];
  }

  getInitMessage() {
    return JSON.parse(JSON.stringify(this._initMessage));
  }

  private _handleParentMessage(event: MessageEvent) {
    let message = event.data as SDKMessage;
    if (message.eventType === "init") {
      if (this._initMessage) {
        console.error("Second init message provided");
      } else {
        this._initMessage = message as SDKInitMessage;
        this._content = { files: [] };
        this._initAppCallback();
      }
    }

    if (message.eventType === "navigate" && this.onNavigate) {
      this.onNavigate((message as SDKNavigateMessage).navigateButtonId);
    }
  }

  public loadMockContentFile(successCallback: (content: SDKContent) => void, failureCallback?: () => void) {
    const MOCK_CONTENT_FILE = "mockcontent.json";
    let xhr = new XMLHttpRequest();
    xhr.open("GET", MOCK_CONTENT_FILE, true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          let mockContent: any;
          try {
            mockContent = JSON.parse(xhr.responseText);
          } catch (e) {
            console.error(`${MOCK_CONTENT_FILE} is not a valid JSON file, check the console for more info`);
            console.error(e);
            console.log(xhr.responseText);
          }
          successCallback(mockContent);
        }
        else {
          if (failureCallback) {
            failureCallback();
          } else {
            console.error(`Failed to load "${MOCK_CONTENT_FILE}", is the development server running (npm start)`);
          }
        }
      }
    };
    xhr.send();
  }

  private _acceptMockContent(mockContent: SDKContent) {
    if (this._content) {
      throw new Error("Mock data file already loaded.");
    }
    this._initMessage = MOCK_INIT_MESSAGE;
    this._content = mockContent;
    const seconds = 5;
    setTimeout(() => {
      if (!this._sentReadyEvent) {
        console.error(`WARNING: this app is taking too long to be ready. It should call notifyAppIsReady() as soon as it is rendered.`);
      }
    }, seconds * 1000);
    this._initAppCallback();
  }

  private _checkContentLoaded() {
    if (!this._content) {
      throw new Error("Content has not been loaded yet.");
    }
  }
}

const MOCK_INIT_MESSAGE: SDKInitMessage = {
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

export interface SDKContent {
  files: SDKFile[];
}

export interface SDKFile {
  /**
   * A string unique within the scope of the currently loaded content
   */
  id: string;

  /**
   * A data URI with file type and content, e.g. data:image/jpeg;base64,/9j/4A
   */
  data: string;
}

export interface SDKMessage {
  eventType: string;
}

export interface SDKInitMessage extends SDKMessage {
  shapes: SDKCircle[];
  widthPx: number;
  heightPx: number;
  resolutionPixelsPerCm: number;
  contentAreas: SDKRectangle[];
}

export interface SDKShape {
  type: string;
}

export interface SDKCircle extends SDKShape {
  id: number;
  x: number;
  y: number;
  radius: number;
  borderWidth: number;
  rotationDegrees: number;
}

export interface SDKRectangle extends SDKShape {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDegrees: number;
}

export interface SDKInteractionsMessage extends SDKMessage {
  interactions: SDKInteractionPoint[];
}

export interface SDKInteractionPoint {
  id: number;
  phase: string;
  x: number;
  y: number;
}

export interface SDKNavigateMessage extends SDKMessage {
  navigateButtonId: string;
}

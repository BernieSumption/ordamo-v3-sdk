"use strict";

export const enum RunningMode {
  /**
   * We are running in a browser inside a frame: assumed to mean that we're hosted
   * in the Ordamo Application Host program
   */
  HOSTED = 1,

  /**
   * We are running in a browser outside of a frame: assumed to mean development
   * or testing
   */
  DEVELOPMENT,

  /**
   * We are running unit tests
   */
  UNIT_TESTS
}

let RUNNING_MODE: RunningMode;
if (typeof window === "undefined") {
  RUNNING_MODE = RunningMode.UNIT_TESTS;
} else if (window === top) {
  RUNNING_MODE = RunningMode.DEVELOPMENT;
} else {
  RUNNING_MODE = RunningMode.HOSTED;
}

let INSTANCE_CREATED = false;

const EMPTY_DATA_URI = "data:text/plain;charset=utf-8,";


/**
 * Return the SDK running mode, useful for distinguishing between test and live
 */
export function getRunningMode() {
  return RUNNING_MODE;
}

/**
 * The main class of the SDK. Your app is responsible for creating a single instance.
 */
export class OrdamoSDK<T> {

  public onNavigate: (event: string) => void;

  private _content: SDKContent<T>;
  private _filesById: { [id: string]: SDKFile };

  private _initMessage: SDKInitMessage;
  private _sentReadyEvent = false;

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
  constructor(private _initAppCallback?: Function, private _providedContent?: SDKContent<T>) {
    if (RUNNING_MODE === RunningMode.DEVELOPMENT) {
      console.log(`OrdamoSDK running in development mode.`);
    }
    if (INSTANCE_CREATED && RUNNING_MODE !== RunningMode.UNIT_TESTS) {
      throw new Error("Only one instance of OrdamoSDK may be created per application " + RUNNING_MODE);
    }
    INSTANCE_CREATED = true;
    if (RUNNING_MODE === RunningMode.DEVELOPMENT) {
      this.loadMockContentFile(this._acceptMockContent.bind(this));
    }
    else if (RUNNING_MODE === RunningMode.HOSTED) {
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
      if (RUNNING_MODE === RunningMode.HOSTED) {
        parent.postMessage({ eventType: "ready" }, "*");
      }
    }
  }

  /**
   * Return a list of the file objects provided with this app's content
   */
  getFiles(): SDKFile[] {
    this._checkContentLoaded();
    return this._content.files as SDKFile[];
  }

  /**
   * Return a list of the file objects provided with this app's content.
   * 
   * If the id does not exist, log an error and return an empty file. This behaviour
   * allows missing images to result in visual defects rather than application crashes.
   */
  getFile(id: string): SDKFile {
    this._checkContentLoaded();
    if (this._filesById[id]) {
      return this._filesById[id];
    } else {
      console.error(`File "${id}" does not exist, returning an empty file.`);
      return {
        id: id,
        data: EMPTY_DATA_URI
      };
    }
  }

  /**
   * Return a list of the file objects provided with this app's content
   */
  getData(): T {
    this._checkContentLoaded();
    return this._content.data;
  }

  /**
   * Return the init message provided by the host applicatio, which includes
   * layout information
   */
  getInitMessage(): SDKInitMessage {
    this._checkContentLoaded();
    return JSON.parse(JSON.stringify(this._initMessage));
  }

  /**
   * Request that the host application closes this app and returns to the default app.
   */
  requestAppClose() {
    if (RUNNING_MODE === RunningMode.HOSTED) {
      parent.postMessage({ eventType: "close" }, "*");
    } else if (RUNNING_MODE === RunningMode.DEVELOPMENT) {
      document.body.style.transition = "opacity 1s, visibility 0s linear 1s";
      document.body.style.opacity = "0";
      document.body.style.visibility = "hidden";
      console.log("The app has been closed. In a hosted application, the user would now be seeing the main menu.");
    }
  }

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
  setRemUnitDiameterOfPlateSpot(plateSpotRemWidth: number) {
    this._checkContentLoaded();
    let plateSpot = this._initMessage.plateSpots[0];
    if (plateSpot) {
      document.documentElement.style.fontSize = (plateSpot.radius * 2 / plateSpotRemWidth) + "px";
    }
  }


  //
  // PRIVATE STUFF
  //

  private _handleParentMessage(event: MessageEvent) {
    let message = event.data as SDKMessage;
    if (message.eventType === "init") {
      if (this._initMessage) {
        console.error("Second init message sent, ignoring");
      } else {
        let duckMessage = message as any;
        if (duckMessage.shapes && !duckMessage.plateSpots) {
          // compatibility with older API servers that called "plateSpots" "shapes"
          duckMessage.plateSpots = duckMessage.shapes;
        }
        this._initMessage = message as SDKInitMessage;
        this._acceptContent(this._providedContent || { files: [], data: null });
        this._initAppCallback();
      }
    }

    if (message.eventType === "navigate" && this.onNavigate) {
      this.onNavigate((message as SDKNavigateMessage).navigateButtonId);
    }
  }

  public loadMockContentFile(successCallback: (content: SDKContent<T>) => void, failureCallback?: () => void) {
    if (this._providedContent) {
      setTimeout(() => successCallback(this._providedContent), 1);
    } else {
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
  }

  private _acceptMockContent(mockContent: SDKContent<T>) {
    if (this._content) {
      throw new Error("Mock data file already loaded.");
    }
    this._acceptContent(mockContent);
    this._initMessage = makeMockInitMessage();
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

  private _acceptContent(content: SDKContent<T>) {
    this._content = content;
    this._filesById = {};
    for (let file of this._content.files) {
      this._filesById[file.id] = file;
    }
  }
}

function makeMockInitMessage(): SDKInitMessage {
  let queryParams: { [key: string]: number } = {};
  document.location.href.replace(/[?&]([^=]+)=([^&]*)?/g, (match, name, value) => queryParams[name] = parseInt(value) as any);

  if (queryParams["rotation"] % 90) {
    console.error(`You have set rotation=${queryParams["rotation"]} - the SDK only supports rotations that are a multiple of 90 degrees`);
    queryParams["rotation"] = Math.round(queryParams["rotation"] / 90) * 90;
  }

  const numPlateSpots = isNaN(queryParams["plateSpots"]) ? 2 : queryParams["plateSpots"],
    numContentAreas = isNaN(queryParams["contentAreas"]) ? 1 : queryParams["contentAreas"],
    width = window.innerWidth,
    height = window.innerHeight,
    padding = 20,
    columns = Math.min(3, numPlateSpots + numContentAreas),
    rows = Math.ceil((numPlateSpots + numContentAreas) / columns),
    radius = Math.min((width - padding * (columns + 1)) / columns, (height - padding * (rows + 1)) / rows) / 2,
    size = padding + radius * 2;

  console.log(`Making mock layout with ${numPlateSpots} plate spots and ${numContentAreas} content areas. Control the layout with URL parameters like so: ?plateSpots=4&contentAreas=2&rotation=0`);

  let item = 0, column = 0, row = 0, x = 0, y = 0, rotation = queryParams["rotation"];
  return {
    "eventType": "init",
    "widthPx": width,
    "heightPx": width,
    "resolutionPixelsPerCm": 12,
    "plateSpots": layout(numPlateSpots, (): SDKCircle => {
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
    "contentAreas": layout(numContentAreas, (): SDKRectangle => {
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
  function layout<T>(n: number, f: () => T): T[] {
    let results: T[] = [];
    for (let i = 0; i < n; i++) {
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



export interface SDKContent<T> {
  data: T;
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
  plateSpots: SDKCircle[];
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

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

const MAX_SAVED_STATE_SECONDS = 10 * 60;

/**
 * Return the SDK running mode, useful for distinguishing between test and live
 */
export function getRunningMode() {
  return RUNNING_MODE;
}

export interface OrdamoSDKOptions<T> {
  /**
   * Required. A description of the content requirements of this SDK applicaiton,
   * created using the sdk content functions e.g. {myImage: sdk.image(...)} 
   */
  contentSchema: T;

  /**
   * Required. A function to be called when data loading is complete and the
   * app may begin rendering itself based on the layout and content.
   */
  initCallback: () => void;

  /**
   * An optional function to save the current state of the application. If provided, the
   * result of calling this function will be available through sdkInstance.getSavedState()
   * next time the application is launched, if it is still in use by the same users(s).
   */
  saveStateCallback?: () => any;

  /**
   * A content object. If absent, the behaviour of the system is to load content from
   * "default-content.json" during development and to receive content form the application
   * host during production.
   * 
   * Setting this option overrides the default content source with a specific object.
   */
  contentOverride?: T;
}

/**
 * The main class of the SDK. Your app is responsible for creating a single instance.
 */
export class OrdamoSDK<T> {

  public onNavigate: (event: string) => void;

  private _initMessage: InitMessage<T>;
  private _sentReadyEvent = false;
  private _savedState: any = null;

  /**
   * When the OrdamoSDK instance is created it will communicate with the host application to
   * request the app's layout and content (or in development mode, use a mock layout and
   * load content from default-content.json).
   * 
   * @param _contentSchema 
   * 
   * @param _initAppCallback 
   */
  constructor(private _options: OrdamoSDKOptions<T>) {
    if (RUNNING_MODE === RunningMode.DEVELOPMENT) {
      logNotice(`running in development mode.`);

      logNotice("Emulating touch events.");
      startTouchEmulation();

      let chromeVersion = /\bChrome\/(\d+)/.exec(navigator.userAgent);
      if (!(chromeVersion && parseInt(chromeVersion[1]) >= 46)) {
        alert("Sorry, Ordamo V3 apps require a recent version of Google Chrome to run. Please load this app in Chrome, and/or ensure that your copy of Chrome is up to date.");
        throw new Error("Bad browser: " + navigator.userAgent);
      }
    }
    if (INSTANCE_CREATED && RUNNING_MODE !== RunningMode.UNIT_TESTS) {
      throw new Error("Only one instance of OrdamoSDK may be created per application " + RUNNING_MODE);
    }
    INSTANCE_CREATED = true;
    if (RUNNING_MODE === RunningMode.DEVELOPMENT) {
      this._initialiseDevelopmentData();
    }
    else if (RUNNING_MODE === RunningMode.HOSTED) {
      window.addEventListener("message", this._handleParentMessage.bind(this));
      parent.postMessage({ eventType: "load" }, "*");
    }
    this._restoreState();
  }

  private _getSavedStateKey() {
    return "ordamo-sdk-content-" + document.location.pathname;
  }

  /**
   * This must be called once only after the app has rendered itself
   * and it is safe to display. The app will be hidden until this is
   */
  notifyAppIsReady(): void {
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

  getContent(): T {
    this._requireInitMessage();
    return this._initMessage.content;
  }

  getLayout(): Layout {
    this._requireInitMessage();
    return this._initMessage.layout;
  }

  /**
   * Return the saved state as created by the saveStateCallback constructor option last
   * time the application quit.
   * 
   * WARNING: restoring saved state is a common source of application errors, especially
   * just after an application update when the saved state was created by the previous
   * version of the application. Validate that the state meets your expectations and wrap
   * your restoration code in a try/catch block.
   */
  getSavedState() {
    this._requireInitMessage();
    return this._savedState;
  }

  /**
   * Request that the host application closes this app and returns to the default app.
   */
  requestAppClose(): void {
    this._requireInitMessage();
    if (RUNNING_MODE === RunningMode.HOSTED) {
      parent.postMessage({ eventType: "close" }, "*");
    } else if (RUNNING_MODE === RunningMode.DEVELOPMENT) {
      document.body.style.transition = "opacity 1s, visibility 0s linear 1s";
      document.body.style.opacity = "0";
      document.body.style.visibility = "hidden";
      logNotice("The app has been closed. In a hosted application, the user would now be seeing the main menu.");
    }
    if (this._options.saveStateCallback) {
      this._saveState();
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
  setRemUnitDiameterOfPlateSpot(plateSpotRemWidth: number): void {
    this._requireInitMessage();
    let plateSpot = this._initMessage.layout.plateSpots[0];
    if (plateSpot) {
      document.documentElement.style.fontSize = (plateSpot.radius * 2 / plateSpotRemWidth) + "px";
    }
  }


  //
  // PRIVATE STUFF
  //

  private _handleParentMessage(event: MessageEvent) {
    let message = event.data as Message;
    if (message.eventType === "init") {
      if (this._initMessage) {
        console.error("Second init message sent, ignoring");
      } else {
        let duckMessage = message as any;
        if (duckMessage.shapes && !duckMessage.plateSpots) {
          // compatibility with older API servers that called "plateSpots" "shapes"
          duckMessage.plateSpots = duckMessage.shapes;
        }
        let initMessage = message as InitMessage<T>;
        if (this._options.contentOverride) {
          initMessage.content = this._options.contentOverride;
        }
        this._receiveInitMessage(initMessage);
      }
    }

    if (message.eventType === "navigate" && this.onNavigate) {
      this.onNavigate((message as NavigateMessage).navigateButtonId);
    }
  }

  private _initialiseDevelopmentData() {
    if (this._options.contentOverride) {
      setTimeout(() => this._receiveDevelopmentContent(this._options.contentOverride), 1);
    } else {
      const DEFAULT_CONTENT_FILE = "default-content.json";
      let xhr = new XMLHttpRequest();
      xhr.open("GET", DEFAULT_CONTENT_FILE, true);
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            let content: any;
            try {
              content = JSON.parse(xhr.responseText);
            } catch (e) {
              console.error(`${DEFAULT_CONTENT_FILE} is not a valid JSON file, check the console for more info`);
              console.error(e);
              logNotice("This content is not JSON", xhr.responseText);
            }
            if (content) {
              this._receiveDevelopmentContent(content);
              const TIMEOUT_SECONDS = 5;
              setTimeout(() => {
                if (!this._sentReadyEvent) {
                  console.error(`WARNING: this app is taking too long to be ready. It should render in less than ${TIMEOUT_SECONDS} seconds then call notifyAppIsReady().`);
                }
              }, TIMEOUT_SECONDS * 1000);
            }
          }
          else {
            console.error(`Failed to load "${DEFAULT_CONTENT_FILE}", is the development server running (npm start)`);
          }
        }
      };
      xhr.send();
    }
  }

  private _receiveDevelopmentContent(content: T) {
    this._receiveInitMessage({
      eventType: "init",
      content: content,
      layout: makeMockLayout()
    });
  }

  private _requireInitMessage() {
    if (!this._initMessage) {
      throw new Error("The SDK has not initialised yet.");
    }
  }

  private _receiveInitMessage(message: InitMessage<T>): void {
    if (this._initMessage) {
      logError("Duplicate init message received, ignoring");
      return;
    }
    this._initMessage = message;
    if (this._options.initCallback) {
      this._options.initCallback();
    }
  }

  private _saveState() {
    if (this._options.saveStateCallback) {
      let storedForm: StoredState = {
        timestamp: Date.now(),
        state: this._options.saveStateCallback()
      };
      sessionStorage.setItem(this._getSavedStateKey(), JSON.stringify(storedForm));
    }
  }

  private _restoreState() {
    let storedForm = sessionStorage.getItem(this._getSavedStateKey());
    if (storedForm) {
      try {
        let save: StoredState = JSON.parse(storedForm);
        if (Date.now() - save.timestamp < MAX_SAVED_STATE_SECONDS * 1000) {
          this._savedState = save.state;
        } else {
          logNotice(`Ignoring saved state older than ${MAX_SAVED_STATE_SECONDS} seconds.`);
          this._clearState();
        }
      } catch (e) {
        console.error("Error parsing save data, wiping saved state", e, storedForm);
        this._clearState();
      }
    }
  }

  private _clearState() {
    sessionStorage.removeItem(this._getSavedStateKey());
  }
}

function logError(message: string) {
  if (RUNNING_MODE === RunningMode.HOSTED) {
    console.error(message);
  } else {
    throw new Error(message);
  }
}

interface StoredState {
  state: string;
  timestamp: number;
}

//
// CONTENT TYPES
//

export interface ContentOptions {
  // A short name for the field in the CMS, e.g. "Greeting message"
  fieldName: string;
  // An optional longer description of the field shown to users if they need more information,
  // e.g. "The message shown to users when they first open the app"
  helpText?: string;
}

/**
 * A specification for a bit of content that is to be provided to the
 * app by the CMS
 */
export interface ContentDescriptor<T> {
  // the type of this object, formed by taking the lowercase interface name
  // minus the "description", e.g. an ImageDescriptor must have a type` value of "image"
  type: string;
  // The value provided by the CMS. 
  value?: T;
}

export interface ImageOptions extends ContentOptions {
  // minumum width of the image in pixels
  minWidth: number;
  // maximum width of the image in pixels
  maxWidth: number;
  // minumum height of the image in pixels
  minHeight: number;
  // maximum height of the image in pixels
  maxHeight: number;
  // an optional aspect ratio to constrain the image to
  aspectRatio?: number;
}

export interface ImageDescriptor extends ContentDescriptor<string> {
  options: ImageOptions;
}

/**
 * Helper function for defining content managed images.
 * 
 * This function is typed `string` mecause that's what will be provided by the CMS. However
 * it actually returns an ImageDescriptor object containing instructions for the CMS.
 */
export function image(options: ImageOptions): string {
  let descriptor: ImageDescriptor = {
    type: "image",
    options: options
  };
  return descriptor as any;
}

export interface ListOptions<T> {
  // the inclusive minumum number of items in the list
  min: number;
  // the inclusive maximum number of items in the list, 
  max: number;
  // a content descriptor for individual items, e.g. as created by sdk.image()
  items: T;
}

export interface ListDescriptor<T> extends ContentDescriptor<T[]> {
  min: number;
  max: number;
  items: ContentDescriptor<T>;
}

/**
 * Helper function for defining lists of content managed items.
 * 
 * This function is typed `T[]` where `T` is e.g. `string` in the case of images, because
 * that's what will be provided by the CMS. However it actually returns an ListDescriptor
 * object containing instructions for the CMS.
 */
export function list<T>(options: ListOptions<T>): T[] {
  let itemDescriptor: ContentDescriptor<T> = options.items as any;
  if (typeof itemDescriptor.type !== "string") {
    throw new Error("items must be a content descriptor, e.g. as returned by sdk.image()");
  }
  let descriptor: ListDescriptor<T> = {
    type: "list",
    min: options.min,
    max: options.max,
    items: itemDescriptor
  };
  return descriptor as any;
}


//
// MESSAGE TYPES
//

export interface Message {
  eventType: string;
}

export interface InitMessage<T> extends Message {
  content: T;
  layout: Layout;
}

export interface Layout {
  plateSpots: Circle[];
  widthPx: number;
  heightPx: number;
  resolutionPixelsPerCm: number;
  contentAreas: Rectangle[];
}

export interface Shape {
  type: string;
}

export interface Circle extends Shape {
  id: number;
  x: number;
  y: number;
  radius: number;
  borderWidth: number;
  rotationDegrees: number;
}

export interface Rectangle extends Shape {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDegrees: number;
}

export interface InteractionsMessage extends Message {
  interactions: InteractionPoint[];
}

export interface InteractionPoint {
  id: number;
  phase: string;
  x: number;
  y: number;
}

export interface NavigateMessage extends Message {
  navigateButtonId: string;
}


//
// DEVELOPMENT UTILITIES
//

function logNotice(message: string, ...additional: any[]) {
  console.log(`Ordamo SDK: ${message}`, ...additional);
}


function makeMockLayout(): Layout {
  let queryParams: { [key: string]: number } = {};
  document.location.href.replace(/[?&]([^=]+)=([^&]*)?/g, (match, name, value) => queryParams[name] = parseInt(value) as any);

  if (queryParams["rotation"] % 90) {
    console.error(`You have set rotation=${queryParams["rotation"]} - the SDK only supports rotations that are a multiple of 90 degrees`);
    queryParams["rotation"] = Math.round(queryParams["rotation"] / 90) * 90;
  }

  const numPlateSpots = isNaN(queryParams["plateSpots"]) ? 2 : queryParams["plateSpots"],
    numContentAreas = isNaN(queryParams["contentAreas"]) ? 1 : queryParams["contentAreas"],
    clearCentreSpace = queryParams["avoidCentre"] ? 1 : 0,
    width = window.innerWidth,
    height = window.innerHeight,
    padding = 20,
    columns = Math.min(3, numPlateSpots + numContentAreas + clearCentreSpace),
    rows = Math.ceil((numPlateSpots + numContentAreas + clearCentreSpace) / columns),
    radius = Math.min((width - padding * (columns + 1)) / columns, (height - padding * (rows + 1)) / rows) / 2,
    size = padding + radius * 2;

  logNotice(`Making mock layout with ${numPlateSpots} plate spots and ${numContentAreas} content areas${clearCentreSpace ? " and keeping the centre clear" : ""}. Control the layout with URL parameters like so: ?plateSpots=4&contentAreas=2&rotation=0&avoidCentre=1`);

  let item = 0, itemOffset = 0, column = 0, row = 0, x = 0, y = 0, rotation = queryParams["rotation"];
  return {
    "widthPx": width,
    "heightPx": width,
    "resolutionPixelsPerCm": 12,
    "plateSpots": flowLayout(numPlateSpots, (): Circle => {
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
    "contentAreas": flowLayout(numContentAreas, (): Rectangle => {
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
  function flowLayout<I>(itemCount: number, itemFactory: () => I): I[] {
    let results: I[] = [];
    for (let i = 0; i < itemCount; i++) {
      computeXY();
      if (clearCentreSpace) {
        let dx = (window.innerWidth / 2 - x);
        let dy = (window.innerHeight / 2 - y);
        let centreDistance = Math.sqrt(dx * dx + dy * dy);
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

  let currentElement: HTMLElement;
  let hasNativeTouchEvents = false;

  window.addEventListener("touchstart", checkForNativeEvent, true);

  window.addEventListener("mousedown", handleMouseEvent("touchstart"), true);
  window.addEventListener("mousemove", handleMouseEvent("touchmove"), true);
  window.addEventListener("mouseup", handleMouseEvent("touchend"), true);

  window.addEventListener("click", killEventDead, true);
  window.addEventListener("mouseenter", killEventDead, true);
  window.addEventListener("mouseleave", killEventDead, true);
  window.addEventListener("mouseout", killEventDead, true);
  window.addEventListener("mouseover", killEventDead, true);

  function killEventDead(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleMouseEvent(touchType: string) {
    return function (mouseEvent: MouseEvent) {

      if ((mouseEvent.target as HTMLElement).nodeName !== "INPUT") {  // messing with native events on inputs breaks them

        killEventDead(mouseEvent);

        if (mouseEvent.button !== 0 || hasNativeTouchEvents) {
          return;
        }

        if (mouseEvent.type === "mousedown") {
          currentElement = mouseEvent.target as HTMLElement;
          if (currentElement.nodeType !== Node.ELEMENT_NODE) {
            currentElement = currentElement.parentElement;
          }
        }

        if (!currentElement) {
          return;
        }

        let touch = new (Touch as any)({
          identifier: 1,
          target: currentElement,
          clientX: mouseEvent.clientX,
          clientY: mouseEvent.clientY,
          pageX: mouseEvent.pageX,
          pageXY: mouseEvent.pageY,
          screenX: mouseEvent.screenX,
          screenY: mouseEvent.screenY,
        });

        let touchEvent = new (TouchEvent as any)(touchType, {
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

  function checkForNativeEvent(e: TouchEvent) {
    if (e.isTrusted) {
      window.removeEventListener("touchstart", checkForNativeEvent, true);
      hasNativeTouchEvents = true;
    }
  }
}

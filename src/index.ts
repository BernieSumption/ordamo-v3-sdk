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
   * A description of the content requirements of this SDK applicaiton,
   * created using the sdk content functions e.g. {myImage: sdk.image(...)}.
   * 
   * This is used to generate a CMS interface for the app, and can be ommitted for apps
   * with no managed content.
   */
  contentSchema?: T;

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
   * A convenience property to set the initial value of OrdamoSDK.onNavigate
   */
  onNavigate?: (navigate: NavigateMessage) => void;

  /**
   * If true, this app will be displayed in a focussed full screen iframe, covering the
   * apphost and being capable of receiving native touch events. This means that the app
   * must display a prominent "exit" button that calls the SDK requestAppClose() method.
   *
   * If false or absent, this app will be displayed under the apphost UI, with white fuzzyy
   * circles (plate spots) superimposed over the locations of diners plates ensuring that
   * patterns are not projected over food. The app will not receive focus, or native touch
   * events, clicking it will bring up the apphost's navigation menu.
   *
   * In general, fullscreen apps are suitable for engaging experiences like games, and
   * non-fulscreen apps are better for "tablecloth style"" experiences that can continue
   * in the background while diners are eating.
   */
  fullscreen?: boolean;

  /**
   * A convenience property to set the initial value of OrdamoSDK.onInteractions
   */
  onInteractions?: (interactions: InteractionsMessage) => void;
}

/**
 * The main class of the SDK. Your app is responsible for creating a single instance.
 */
export class OrdamoSDK<T> {

  private _initMessage: InitMessage;
  private _content: any;
  private _sentReadyEvent = false;
  private _savedState: any = null;

  private _contentSchema: T;
  private _initCallback: () => void;
  private _saveStateCallback: () => any;
  private _fullscreen: boolean;

  /**
   * When the OrdamoSDK instance is created it will communicate with the host application to
   * request the app's layout and content (or in development mode, use a mock layout and
   * load content from default-content.json).
   *
   * @param _contentSchema
   *
   * @param _initAppCallback
   */
  constructor(options: OrdamoSDKOptions<T>) {

    if (INSTANCE_CREATED && RUNNING_MODE !== RunningMode.UNIT_TESTS) {
      throw new Error("Only one instance of OrdamoSDK may be created per application " + RUNNING_MODE);
    }
    INSTANCE_CREATED = true;

    this.onInteractions = options.onInteractions;
    this.onNavigate = options.onNavigate;

    this._contentSchema = options.contentSchema;
    this._initCallback = options.initCallback;
    this._saveStateCallback = options.saveStateCallback;
    this._fullscreen = options.fullscreen;

    this._initialise();
  }

  private _initialise() {
    if (RUNNING_MODE === RunningMode.UNIT_TESTS) return;

    if (document.readyState !== "complete") {
      document.addEventListener("readystatechange", () => {
        if (document.readyState === "complete") {
          this._initialise();
        }
      });
      return;
    }

    if (RUNNING_MODE === RunningMode.DEVELOPMENT) {
      this._initialiseDevelopmentMode();
    }
    else if (RUNNING_MODE === RunningMode.HOSTED) {
      this._initialiseHostedMode();
    }

    this._startTouchEmulation();
  }

  private _getSavedStateKey() {
    return "ordamo-sdk-content-" + document.location.pathname;
  }

  /**
   * This must be called once only after the app has rendered itself
   * and it is safe to display. The app will be hidden until this is called, preventing the user
   * from seeing e.g. half-loaded content.
   */
  notifyAppIsReady(): void {
    if (!this._initMessage) {
      throw new Error("Illegal call to notifyAppIsReady() before init callback has fired.");
    }
    if (!this._sentReadyEvent) {
      this._sentReadyEvent = true;
      if (RUNNING_MODE === RunningMode.HOSTED) {
        this._sendParentMessage({ eventType: "ready" });
      }
    }
  }

  /**
   * Return the content that the app should render. If specific content has been created using
   * the CMS, that content will be provided through this method, otherwise the default content
   * from default-content.json will be returned.
   */
  getContent(): T {
    this._requireInitMessage();
    return this._content;
  }

  /**
   * Get the table's current layout. Each restaurant table may be a different physical size with
   * a different number and position of plates.
   */
  getLayout(): Layout {
    this._requireInitMessage();
    return this._initMessage.layout;
  }

  /**
   * Return the table label provided by the apphost.
   * 
   * See InitMessage.table for format information.
   */
  getTableLabel(): string {
    this._requireInitMessage();
    return this._initMessage.table;
  }

  /**
   * Return the requiredWidth value from the app's metadata, or undefined if no requiredWidth is set
   */
  getRequiredWidth(): number {
    this._requireInitMessage();
    return this._initMessage.requiredWidth;
  }

  /**
   * Return the requiredHeight value from the app's metadata, or undefined if no requiredHeight is set
   */
  getRequiredHeight(): number {
    this._requireInitMessage();
    return this._initMessage.requiredHeight;
  }

  /**
   * Sent by the host to non-fullscreen apps when there has been some interaction. Apps
   * can use this to implement *basic* interactivity even in non-fulscreen apps.
   *
   * Bear in mind when using this that when users interact with the apphost they are using
   * the apphost navigation menu, so the app shouldn't do anything distracting in response
   * to these messages that will intefere with the use of the menu. The intention is that
   * apps may use these messages to perform subtle background animations.
   */
  onInteractions: (interactions: InteractionsMessage) => void;

  /**
   * A callback invoked when the user clicks on an icon in the app's nagivation menu
   * (only relavent if the app defines a navigation menu in its metadata)
   *
   * It is passed a NavigateMessage object containing a navigateButtonId string property
   */
  onNavigate: (interactions: NavigateMessage) => void;

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
    if (RUNNING_MODE === RunningMode.HOSTED) {
      this._sendParentMessage({ eventType: "close" });
    } else if (RUNNING_MODE === RunningMode.DEVELOPMENT) {
      document.body.style.transition = "opacity 1s, background 1s, visibility 0s linear 1s";
      document.body.style.opacity = "0";
      document.documentElement.style.background = "#FFF"; // <html> needs a background, or <body>'s one will display even if its hidden
      document.body.style.visibility = "hidden";
      logNotice("The app has been closed. In a hosted application, the user would now be seeing the main menu.");
    }
    if (this._saveStateCallback) {
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
        this._receiveInitMessage(message as InitMessage);
      }
    }

    if (message.eventType === "interactions" && this.onInteractions) {
      this.onInteractions(message as InteractionsMessage);
    }

    if (message.eventType === "navigate" && this.onNavigate) {
      this.onNavigate(message as NavigateMessage);
    }
  }

  private _initialiseHostedMode() {
    window.addEventListener("message", this._handleParentMessage.bind(this));
    let loadMessage: LoadMessage = {
      eventType: "load",
      fullscreen: !!this._fullscreen
    };
    this._sendParentMessage(loadMessage);
  }

  private _sendParentMessage(message: Message) {
    parent.postMessage(message, "*");
  }

  private _initialiseDevelopmentMode() {
    logNotice(`running in development mode.`);

    let isGoogle = navigator.vendor && navigator.vendor.indexOf("Google") === 0;
    let chromeVersion = /\bChrome\/(\d+)/.exec(navigator.userAgent);
    if (!(isGoogle && chromeVersion && parseInt(chromeVersion[1]) >= 46)) {
      alert("Sorry, Ordamo V3 apps require a recent version of Google Chrome to run. Please load this app in Chrome, and/or ensure that your copy of Chrome is up to date.");
      throw new Error(`Bad browser: ${navigator.vendor} ${navigator.userAgent}`);
    }

    if (location.href.indexOf("file:") === 0) {
      alert(`Ordamo V3 apps must be run from a web server to function correctly - the address must start "http:" or "https:", not "file:".`);
      throw new Error(`Bad browser: ${navigator.vendor} ${navigator.userAgent}`);
    }

    let mockLayout = makeMockLayout();

    this._receiveInitMessage({
      eventType: "init",
      content: null,
      layout: mockLayout,
      table: "1",
      version: `0.${Math.round(Math.random() * 99999)}-MOCKVERSION-SDK-DEVMODE`,
      sessionId: 1,
      requiredWidth: 800,
      requiredHeight: 600,
    });

    if (document.location.search.match(/\bmanualFullscreen=true/)) {
      let goFullscreen = () => {
        if (document.webkitFullscreenEnabled && !document.webkitFullscreenElement) {
          document.body.webkitRequestFullScreen();
        }
      };
      document.body.addEventListener("click", goFullscreen);
      document.body.addEventListener("touchstart", goFullscreen);
    }
  }

  private _requireInitMessage() {
    if (!this._initMessage) {
      throw new Error("The SDK has not initialised yet.");
    }
  }

  private _receiveInitMessage(message: InitMessage): void {
    if (this._initMessage) {
      logError("Duplicate init message received, ignoring");
      return;
    }
    this._initMessage = message;
    this._restoreState();
    if (message.content || !this._contentSchema) {
      this._finishInitialisation();
    } else {
      this._loadDefaultContentFile();
    }
  }

  private _finishInitialisation() {

    if (this._contentSchema) {
      this._content = JSON.parse(JSON.stringify(this._contentSchema));
      for (let prop in this._content) {
        this._content[prop].value = this._initMessage.content[prop];
      }
    }

    if (this._initCallback) {
      this._initCallback();
    }


    const TIMEOUT_SECONDS = 5;
    setTimeout(() => {
      if (!this._sentReadyEvent) {
        console.error(`WARNING: this app is taking too long to be ready. It should render in less than ${TIMEOUT_SECONDS} seconds then call notifyAppIsReady().`);
      }
    }, TIMEOUT_SECONDS * 1000);
  }

  private _loadDefaultContentFile() {
    const DEFAULT_CONTENT_FILE = `default-content.json?version=${encodeURIComponent(this._initMessage.version)}`;
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
            this._initMessage.content = content;
            this._finishInitialisation();
          }
        }
        else {
          console.error(`Failed to load "${DEFAULT_CONTENT_FILE}", is the development server running (npm start)`);
        }
      }
    };
    xhr.send();
  }

  private _saveState() {
    if (this._saveStateCallback) {
      let storedForm: StoredState = {
        timestamp: Date.now(),
        state: this._saveStateCallback(),
        appVersion: this._initMessage.version,
        sessionId: this._initMessage.sessionId
      };
      sessionStorage.setItem(this._getSavedStateKey(), JSON.stringify(storedForm));
    }
  }

  private _restoreState() {
    let storedForm = sessionStorage.getItem(this._getSavedStateKey());
    if (storedForm) {
      try {
        let save: StoredState = JSON.parse(storedForm);
        if (save.appVersion !== this._initMessage.version) {
          logNotice(`Ignoring saved state, app version has changed from "${save.appVersion}" to "${this._initMessage.version}".`);
          this._clearState();
        } else if (save.sessionId !== this._initMessage.sessionId) {
          logNotice(`Ignoring saved state, session has changed.`);
          this._clearState();
        } else if (Date.now() - save.timestamp > MAX_SAVED_STATE_SECONDS * 1000) {
          logNotice(`Ignoring saved state older than ${MAX_SAVED_STATE_SECONDS} seconds.`);
          this._clearState();
        } else {
          this._savedState = save.state;
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



  /**
   * Supresses mouse events and convert them to touch events
   */
  private _startTouchEmulation() {

    startTouchEventEmulation();

    if (RUNNING_MODE === RunningMode.DEVELOPMENT && !this._fullscreen) {
      logNotice("Supressing touch events because this app is not fullscreen. Background apps can use OrdamoSDK.onInteractions instead.");
    }

    let interceptTouchEvent = (e: TouchEvent) => {
      if (!this._fullscreen) {
        e.stopPropagation();
        e.preventDefault();
      }
      if (this.onInteractions) {
        this.onInteractions(makeInteractionsMessage([e]));
      }
    };

    document.body.addEventListener("touchstart", interceptTouchEvent, true);
    document.body.addEventListener("touchmove", interceptTouchEvent, true);
    document.body.addEventListener("touchend", interceptTouchEvent, true);
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
  appVersion: string;
  sessionId: number;
}

//
// CONTENT TYPES
//

export interface ContentFieldOptions {
  // A short name for the field in the CMS, e.g. "Greeting message"
  title: string;
  // An optional longer description of the field shown to users if they need more information,
  // e.g. "The message shown to users when they first open the app"
  helpText?: string;
}

/**
 * A specification for a bit of content that is to be provided to the
 * app by the CMS
 */
export interface ContentDescriptor<T> extends ContentFieldOptions {
  /**
   * The type of this object, formed by taking the lowercase interface name
   * minus the "description", e.g. an ImageDescriptor must have a type` value of "image"
   */
  type: string;
  /**
   * The value provided by the CMS.
   */
  value?: T;
}

export interface ImageOptions {
  /**
   * Minumum width of the image in pixels
   */
  minWidth: number;
  /**
   * Maximum width of the image in pixels
   */
  maxWidth: number;
  /**
   * Minumum height of the image in pixels
   */
  minHeight: number;
  /**
   * Maximum height of the image in pixels
   */
  maxHeight: number;
  /**
   * An optional aspect ratio to constrain the image to. This is width / height, so 2 means twice as wide as high
   */
  aspectRatio?: number;
  /**
   * If true, this "image" must be a video file capable of being played
   * by an HTML video element.
   */
  isVideo?: boolean;
}

export interface TextOptions {
  /**
   * Minumum number of characters in the text
   */
  minLength: number;
  /**
   * Maximum number of characters in the text
   */
  maxLength: number;
  /**
   * Whether newlines are permitted in the text
   */
  multiline: boolean;
  /**
   * Optional string structure validation
   */
  validation?: TextValidationOptions;
}

export interface NumberOptions {
  /**
   * Minumum number
   */
  minValue?: number;
  /**
   * Maximum number
   */
  maxValue?: number;
  /**
   * Whether the number must be a round number
   */
  integer: boolean;
}

export interface TextValidationOptions {
  /**
   * A regular expression to validate against, passed into the RegExp constructor. Normally, you
   * want to use "^pattern$" to ensure that you match the whole string not just a substring.
   */
  regex: string;

  /**
   * Valid examples to use in the error message if a CMS user enters an invalid string, optionally
   * multiple valid examples separated with commas as per english text, e.g. "£5, $10.0 or 8HKD"
   * 
   * The error message will read "The value you have entered is invalid, it should looke like ${examples}"
   */
  validExamples: string;
}

export interface ListOptions<O> {
  /**
   * The inclusive minumum number of items in the list
   */
  minCount: number;
  /**
   * The inclusive maximum number of items in the list
   */
  maxCount: number;
  /**
   * An options object describing individual children
   */
  items: O;
}

/**
 * Helper function for defining content managed images.
 */
export function image(options: ImageOptions & ContentFieldOptions): ContentDescriptor<string> & ImageOptions {
  return Object.assign({ type: "image" }, options);
}

/**
 * Helper function for defining content managed text strings.
 */
export function text(options: TextOptions & ContentFieldOptions): ContentDescriptor<string> & TextOptions {
  return Object.assign({ type: "text" }, options);
}

/**
 * Helper function for defining content managed numbers.
 */
export function number(options: NumberOptions & ContentFieldOptions): ContentDescriptor<number> & NumberOptions {
  return Object.assign({ type: "number" }, options);
}

/**
 * Helper function for defining lists of content managed text strings.
 */
export function textList(options: ListOptions<TextOptions> & ContentFieldOptions): ContentDescriptor<string[]> & ListOptions<TextOptions> {
  options.items = Object.assign({ type: "text" }, options.items);
  return Object.assign({ type: "list" }, options);
}

/**
 * Helper function for defining lists of content managed images.
 */
export function imageList(options: ListOptions<ImageOptions> & ContentFieldOptions): ContentDescriptor<string[]> & ListOptions<ImageOptions> {
  options.items = Object.assign({ type: "image" }, options.items);
  return Object.assign({ type: "list" }, options);
}

/**
 * Helper function for defining lists of content managednumbersimages.
 */
export function numberList(options: ListOptions<NumberOptions> & ContentFieldOptions): ContentDescriptor<number[]> & ListOptions<NumberOptions> {
  options.items = Object.assign({ type: "number" }, options.items);
  return Object.assign({ type: "list" }, options);
}


//
// METADATA
//

export const AUTO_METADATA = "ORDAMO_V3_SDK_AUTO_METADATA";

export interface AppMetadata {
  /**
   * A unique app identifier - taken from the "name" in the app's package.json
   */
  id: string;
  /**
   * If the app is deployed on a different server to the apphost, the HTTP url of the app.
   * Apps normally don't set this themselves - it is updated in the metdata file by the
   * person responsible for deploying the app, once the URL is known.
   */
  url?: string;
  /**
   * A short human readable app description - taken from the "description" in the app's package.json
   */
  description: string;
  /**
   * A semver app version - taken from the "version" in the app's package.json
   */
  version: string;
  /**
   * A a default icon used to launch the app, which may be changed in the CMS.
   * A 250x250px image encoded as a data uri.
   */
  defaultIconSrc: string;
  /**
   * Icons to display below this app's icon in the apphost navigation menu.
   */
  menuNodes?: MenuNode[];
  /**
   * The minimum width in pixels that this app requires to display. If less width is available,
   * the app will not be available for users to select through the navigation menu 
   */
  requiredWidth?: number;
  /**
   * The minimum height in pixels that this app requires to display. If less height is available,
   * the app will not be available for users to select through the navigation menu 
   */
  requiredHeight?: number;
}


export interface MenuNode {
  /**
   * Reqired only if launchAppId is present. Uniquely identify this app instance 
   * for content management purposes.
   */
  id?: string;

  /**
   * An icon used for the menu node. THIS IS REQUIRED unless launchAppId is used, in which case
   * it may be optionally ommitted and the app's default icon will be used in place.
   * A 250x250px image encoded as a data uri.
   */
  iconSrc?: string;

  /**
   * If present, clicking this menu item will open up a new level of items below it.
   */
  children?: MenuNode[];

  /**
   * If present, clicking this menu item will cause the SDK's onNavigate callback to be
   * fired with this string as an argument.
   */
  navigateButtonId?: string;

  /**
   * If true, this indicates that the app must have custom content in order to be shown to customers.
   * If no custom content is assigned to the app, it will be hidden in the menu.
   */
  contentRequired?: boolean;

  /**
   * If present, clicking this menu item will cause the app of the specified ID to be
   * launched. WARNING: this is an advanced feature intended for use when several related
   * apps are controlled by a single "master" app. Most app authors do not need to use it.
   */
  launchAppId?: string;

  /**
   * If true, clicking this item will close the menu.
   */
  closeMenu?: boolean;
}

//
// MESSAGE TYPES
//

export interface Message {
  eventType: string;
}

/**
 * Sent from app to host to indicate that the app has loaded and is ready
 * to receive the "init" message.
 */
export interface LoadMessage extends Message {
  /**
   * See OrdamoSDKOptions::fullscreen
   */
  fullscreen: boolean;
}

/**
 * Sent from host to app with the information required by the app to render itself
 */
export interface InitMessage extends Message {
  content: any;
  layout: Layout;

  /**
   * The table label, e.g. "1" or "D" (the format depends on restaurant, but it
   * will be short - 3 characters or less)
   */
  table: string;

  /**
   * The app's version as defined in its metadata file for deployment
   */
  version: string;

  /**
   * A number that will change whenever a new group of people are seated at the table.
   * It is used to decide whether to restore a saved session.
   */
  sessionId: number;
  /**
   * requiredWidth value from the app's metadata 
   */
  requiredWidth?: number;
  /**
   * requiredHeight value from the app's metadata
   */
  requiredHeight?: number;
}

/**
 * Describes the size of the table and the positions of diner places on it 
 */
export interface Layout {
  /**
   * The locations of diner places
   */
  plateSpots: Circle[];
  widthPx: number;
  heightPx: number;
  resolutionPixelsPerCm: number;
  /**
   * "Safe areas" in which content such as images and videos can be rendered without being obscured
   * by any other UI elements. All diners on the table will have one content area that is relatively
   * close to them and rotated in their direction.
   */
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

/**
 * See OrdamoSDKOptions::onInteractions
 */
export interface InteractionsMessage extends Message {
  touchEvents: CrossWindowTouchEvent[];
}

/**
 * A cut down TouchEvent containing only propertis tyhat can be safely passed
 * between windows using postMessage.
 * 
 * Note that this means no DOM elements, therefore there is no event.target or
 * targetTouches
 */
export interface CrossWindowTouchEvent {
  type: string;
  touches: CrossWindowTouch[];
  changedTouches: CrossWindowTouch[];
  // no targetTouches - can't serialise DOM nodes
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * A cut down Touch containing only propertis tyhat can be safely passed
 * between windows using postMessage
 */
export interface CrossWindowTouch {
  identifier: number;
  clientX: number;
  clientY: number;
}

/**
 * An interface implemented by both React.TouchEvent and the native TouchEvent
 */
export interface CommonTouchEvent {
  type: string;
  touches: { [index: number]: CrossWindowTouch, length: number };
  changedTouches: { [index: number]: CrossWindowTouch, length: number };
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function makeInteractionsMessage(events: CommonTouchEvent[], originElement?: HTMLElement): InteractionsMessage {
  let coords: ClientRect;
  if (originElement) {
    coords = originElement.getBoundingClientRect();
  }
  return {
    eventType: "interactions",
    touchEvents: events.map(e => makeCrossWindowTouchEvent(e, coords))
  };
}

export function makeCrossWindowTouchEvent(touchEvent: CommonTouchEvent, originCoords?: ClientRect): CrossWindowTouchEvent {
  let touches: Touch[] = Array.prototype.slice.call(touchEvent.touches);
  let changedTouches: Touch[] = Array.prototype.slice.call(touchEvent.changedTouches);
  return {
    type: touchEvent.type,
    touches: touches.map(t => makeCrossWindowTouch(t, originCoords)),
    changedTouches: changedTouches.map(t => makeCrossWindowTouch(t, originCoords)),
    altKey: touchEvent.altKey,
    ctrlKey: touchEvent.ctrlKey,
    metaKey: touchEvent.metaKey,
    shiftKey: touchEvent.shiftKey,
  };
}

export function makeCrossWindowTouch(touch: Touch, originCoords?: ClientRect): CrossWindowTouch {
  let clientX = touch.clientX;
  let clientY = touch.clientY;
  if (originCoords) {
    clientX -= originCoords.left;
    clientY -= originCoords.top;
  }
  return {
    identifier: touch.identifier,
    clientX,
    clientY
  };
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
    resolution = 12,
    padding = 20,
    columns = Math.min(3, numPlateSpots + numContentAreas + clearCentreSpace),
    rows = Math.ceil((numPlateSpots + numContentAreas + clearCentreSpace) / columns),
    radius = Math.min((width - padding * (columns + 1)) / columns, (height - padding * (rows + 1)) / rows) / 2,
    size = padding + radius * 2;

  logNotice(`Making mock layout ${width}x${height}px (~ ${Math.round(width / resolution)}x${Math.round(height / resolution)}cm) with ${numPlateSpots} plate spots and ${numContentAreas} content areas${clearCentreSpace ? " and keeping the centre clear" : ""}. Control the layout with URL parameters like so: ?plateSpots=4&contentAreas=2&rotation=0&avoidCentre=1`);

  let item = 0, itemOffset = 0, x = 0, y = 0, rotation = queryParams["rotation"];
  return {
    "widthPx": width,
    "heightPx": height,
    "resolutionPixelsPerCm": resolution,
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
 * Supresses mouse events and convert them to touch events, optionally dispatching
 * the touch events on target DOM elements and/or reporting them through a callback. 
 */
export function startTouchEventEmulation() {

  let currentElement: HTMLElement;
  let hasNativeTouchEvents = false;

  let killEventDead = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  let handleMouseEvent = (touchType: string) => {
    return (mouseEvent: MouseEvent) => {

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

        let touch: Touch = new (Touch as any)({
          identifier: 1,
          target: currentElement,
          clientX: mouseEvent.clientX,
          clientY: mouseEvent.clientY,
          pageX: mouseEvent.pageX,
          pageY: mouseEvent.pageY,
          screenX: mouseEvent.screenX,
          screenY: mouseEvent.screenY,
        });

        let touchEvent: TouchEvent = new (TouchEvent as any)(touchType, {
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

  let checkForNativeEvent = (e: TouchEvent) => {
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

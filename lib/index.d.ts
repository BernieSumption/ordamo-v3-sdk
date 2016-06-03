export declare const enum RunningMode {
    /**
     * We are running in a browser inside a frame: assumed to mean that we're hosted
     * in the Ordamo Application Host program
     */
    HOSTED = 1,
    /**
     * We are running in a browser outside of a frame: assumed to mean development
     * or testing
     */
    DEVELOPMENT = 2,
    /**
     * We are running unit tests
     */
    UNIT_TESTS = 3,
}
/**
 * Return the SDK running mode, useful for distinguishing between test and live
 */
export declare function getRunningMode(): RunningMode;
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
     * A callback invoked when the user clicks on an icon in the app's nagivation menu
     * (only relavent if the app defines a navigation menu in its metadata)
     *
     * It is passed a NavigateMessage object containing a navigateButtonId string property
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
     * Sent by the host to non-fullscreen apps when there has been some interaction. Apps
     * can use this to implement *basic* interactivity even in non-fulscreen apps.
     *
     * Bear in mind when using this that when users interact with the apphost they are using
     * the apphost navigation menu, so the app shouldn't do anything distracting in response
     * to these messages that will intefere with the use of the menu. The intention is that
     * apps may use these messages to perform subtle background animations.
     *
     * It is passed a InteractionsMessage object containing an array of InteractionPoint objects
     */
    onInteractions?: (interactions: InteractionsMessage) => void;
}
/**
 * The main class of the SDK. Your app is responsible for creating a single instance.
 */
export declare class OrdamoSDK<T> {
    private _options;
    private _initMessage;
    private _content;
    private _sentReadyEvent;
    private _savedState;
    /**
     * When the OrdamoSDK instance is created it will communicate with the host application to
     * request the app's layout and content (or in development mode, use a mock layout and
     * load content from default-content.json).
     *
     * @param _contentSchema
     *
     * @param _initAppCallback
     */
    constructor(_options: OrdamoSDKOptions<T>);
    private _getSavedStateKey();
    /**
     * This must be called once only after the app has rendered itself
     * and it is safe to display. The app will be hidden until this is
     */
    notifyAppIsReady(): void;
    getContent(): T;
    getLayout(): Layout;
    /**
     * Return the saved state as created by the saveStateCallback constructor option last
     * time the application quit.
     *
     * WARNING: restoring saved state is a common source of application errors, especially
     * just after an application update when the saved state was created by the previous
     * version of the application. Validate that the state meets your expectations and wrap
     * your restoration code in a try/catch block.
     */
    getSavedState(): any;
    /**
     * Request that the host application closes this app and returns to the default app.
     */
    requestAppClose(): void;
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
    setRemUnitDiameterOfPlateSpot(plateSpotRemWidth: number): void;
    private _handleParentMessage(event);
    private _initialiseHostedMode();
    private _sendParentMessage(message);
    private _initialiseDevelopmentMode();
    private _requireInitMessage();
    private _receiveInitMessage(message);
    private _finishInitialisation();
    private _loadDefaultContentFile();
    private _saveState();
    private _restoreState();
    private _clearState();
}
export interface ContentFieldOptions {
    title: string;
    helpText?: string;
}
/**
 * A specification for a bit of content that is to be provided to the
 * app by the CMS
 */
export interface ContentDescriptor<T> {
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
     * An optional aspect ratio to constrain the image to
     */
    aspectRatio?: number;
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
    min: number;
    /**
     * The inclusive maximum number of items in the list, */
    max: number;
    /**
     * An options object describing individual children
     */
    items: O;
}
/**
 * Helper function for defining content managed images.
 */
export declare function image(options: ImageOptions & ContentFieldOptions): ContentDescriptor<string> & ImageOptions & ContentFieldOptions;
/**
 * Helper function for defining content managed text strings.
 */
export declare function text(options: TextOptions & ContentFieldOptions): ContentDescriptor<string> & TextOptions & ContentFieldOptions;
/**
 * Helper function for defining content managed numbers.
 */
export declare function number(options: NumberOptions & ContentFieldOptions): ContentDescriptor<string> & NumberOptions & ContentFieldOptions;
/**
 * Helper function for defining lists of content managed text strings.
 */
export declare function textList(options: ListOptions<TextOptions> & ContentFieldOptions): ContentDescriptor<string[]> & ListOptions<TextOptions> & ContentFieldOptions;
/**
 * Helper function for defining lists of content managed images.
 */
export declare function imageList(options: ListOptions<ImageOptions> & ContentFieldOptions): ContentDescriptor<string[]> & ListOptions<ImageOptions> & ContentFieldOptions;
/**
 * Helper function for defining lists of content managednumbersimages.
 */
export declare function numberList(options: ListOptions<NumberOptions> & ContentFieldOptions): ContentDescriptor<string[]> & ListOptions<NumberOptions> & ContentFieldOptions;
/**
 * Validate a content object against a schema.
 *
 * This function validates that the content has the right set of fields, but does
 * not perform semantic validation e.g. checking that the lengths of strings are
 * within the defined minLength and maxLength bounds.
 */
export declare function validateContent(schema: any, content: any): any;
export interface AppMetadata {
    /**
     * A unique app identifier - taken from the "name" in the app's package.json
     */
    id: string;
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
}
export interface MenuNode {
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
 * See OrdamoSDKOptions::onInteraction
 */
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

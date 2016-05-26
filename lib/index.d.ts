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
export declare class OrdamoSDK<T> {
    private _options;
    onNavigate: (event: string) => void;
    private _initMessage;
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
    private _initialiseDevelopmentData();
    private _receiveDevelopmentContent(content);
    private _requireInitMessage();
    private _receiveInitMessage(message);
    private _saveState();
    private _restoreState();
    private _clearState();
}
export interface ContentOptions {
    fieldName: string;
    helpText?: string;
}
/**
 * A specification for a bit of content that is to be provided to the
 * app by the CMS
 */
export interface ContentDescriptor<T> {
    type: string;
    value?: T;
}
export interface ImageOptions extends ContentOptions {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
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
export declare function image(options: ImageOptions): string;
export interface ListOptions<T> {
    min: number;
    max: number;
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
export declare function list<T>(options: ListOptions<T>): T[];
export interface Message {
    eventType: string;
}
export interface InitMessage<T> extends Message {
    content: T;
    layout: Layout;
}
export interface V1InitMessage extends Message {
    shapes: Circle[];
    widthPx: number;
    heightPx: number;
    resolutionPixelsPerCm: number;
    contentAreas: Rectangle[];
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

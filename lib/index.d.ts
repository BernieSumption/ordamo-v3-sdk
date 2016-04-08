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
/**
 * The main class of the SDK. Your app is responsible for creating a single instance.
 */
export declare class OrdamoSDK<T> {
    private _initAppCallback;
    private _providedContent;
    onNavigate: (event: string) => void;
    private _content;
    private _filesById;
    private _initMessage;
    private _sentReadyEvent;
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
    constructor(_initAppCallback?: Function, _providedContent?: SDKContent<T>);
    /**
     * This must be called once only after the app has rendered itself
     * and it is safe to display. The app will be hidden until this is
     */
    notifyAppIsReady(): void;
    /**
     * Return a list of the file objects provided with this app's content
     */
    getFiles(): SDKFile[];
    /**
     * Return a list of the file objects provided with this app's content.
     *
     * If the id does not exist, log an error and return an empty file. This behaviour
     * allows missing images to result in visual defects rather than application crashes.
     */
    getFile(id: string): SDKFile;
    /**
     * Return a list of the file objects provided with this app's content
     */
    getData(): T;
    /**
     * Return the init message provided by the host applicatio, which includes
     * layout information
     */
    getInitMessage(): SDKInitMessage;
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
    loadMockContentFile(successCallback: (content: SDKContent<T>) => void, failureCallback?: () => void): void;
    private _acceptMockContent(mockContent);
    private _checkContentLoaded();
    private _acceptContent(content);
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

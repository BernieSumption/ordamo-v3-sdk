export declare class OrdamoSDK {
    private _initAppCallback;
    onNavigate: (event: string) => void;
    private _content;
    private _initMessage;
    private _sentReadyEvent;
    constructor(_initAppCallback: Function);
    /**
     * This must be called once only after the app has rendered itself
     * and it is safe to display. The app will be hidden until this is
     */
    notifyAppIsReady(): void;
    getFiles(): SDKFile[];
    getInitMessage(): any;
    private _handleParentMessage(event);
    loadMockContentFile(successCallback: (content: SDKContent) => void, failureCallback?: () => void): void;
    private _acceptMockContent(mockContent);
    private _checkContentLoaded();
}
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

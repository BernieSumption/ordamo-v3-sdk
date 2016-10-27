/// <reference path="../../typings/index.d.ts" />
export declare function ensureParentDirExists(file: string): void;
export declare function fatalError(message: string): void;
export interface Command {
    name: string;
    doc: string;
    args?: {
        name: string;
        doc: string;
        optional?: boolean;
    }[];
    func: Function;
}

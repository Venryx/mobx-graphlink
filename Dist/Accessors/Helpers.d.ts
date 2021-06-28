import { GraphOptions } from "../Graphlink.js";
/** Accessor wrapper which throws an error if one of the base db-requests is still loading. (to be used in Command.Validate functions) */
export declare function GetWait<T>(dataGetterFunc: () => T, options?: Partial<GraphOptions>, funcName?: string): T;
export declare class GetAsync_Options {
    static default: GetAsync_Options;
    /** Just meant to alert us for infinite-loop-like calls/getter-funcs. Default: 50 [pretty arbitrary] */
    maxIterations?: number | undefined;
    errorHandling?: "none" | "log" | "ignore" | undefined;
    /** If true, db requests within dataGetterFunc that find themselves waiting for remote db-data, with throw an error immediately. (avoiding higher-level processing) */
    throwImmediatelyOnDBWait: boolean;
}
export declare let GetAsync_throwImmediatelyOnDBWait_activeDepth: number;
export declare function NotifyWaitingForDB(dbPath: string): void;
export declare function GetAsync<T>(dataGetterFunc: () => T, options?: Partial<GraphOptions> & GetAsync_Options): Promise<T>;
export declare let AssertV_triggerDebugger: boolean;
/** Variant of Assert, which does not trigger the debugger. (to be used in mobx-graphlink Command.Validate functions, since it's okay/expected for those to fail asserts) */
export declare function AssertV(condition: any, messageOrMessageFunc?: string | Function): condition is true;
declare global {
    interface Function {
        /** Helper object for making in-line assertions. */
        get AV(): AVWrapper;
    }
}
/** Helper class for making in-line assertions. */
declare class AVWrapper {
    static generic: AVWrapper;
    constructor(propNameOrGetter: string | ((..._: any[]) => any));
    private propName;
    NonNull_<T>(value: T): T;
    set NonNull(value: any);
}
/** Helper object for making in-line assertions. */
export declare const AV: AVWrapper;
export declare let storeAccessorCachingTempDisabled: boolean;
export {};

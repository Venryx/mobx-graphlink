import { GraphOptions } from "../Graphlink.js";
/** Accessor wrapper which throws an error if one of the base db-requests is still loading. (to be used in Command.Validate functions) */
export declare function GetWait<T>(dataGetterFunc: () => T, options?: Partial<GraphOptions>): T;
export declare class GetAsync_Options {
    static default: GetAsync_Options;
    maxIterations?: number | undefined;
    errorHandling?: "none" | "log" | "ignore" | undefined;
}
export declare function GetAsync<T>(dataGetterFunc: () => T, options?: Partial<GraphOptions> & GetAsync_Options): Promise<T>;
export declare let AssertV_triggerDebugger: boolean;
/** Variant of Assert, which does not trigger the debugger. (to be used in mobx-graphlink Command.Validate functions, since it's okay/expected for those to fail asserts) */
export declare function AssertV(condition: any, messageOrMessageFunc?: string | Function): condition is true;
export declare const AV: ((propName: string) => AVWrapper) & {
    NonNull_<T>(value: T): T;
    NonNull: any;
};
declare class AVWrapper {
    propName: string;
    static generic: AVWrapper;
    constructor(propName: string);
    NonNull_<T>(value: T): T;
    set NonNull(value: any);
}
export declare let storeAccessorCachingTempDisabled: boolean;
export {};

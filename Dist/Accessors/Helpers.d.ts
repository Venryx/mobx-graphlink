import { GraphOptions } from "../Graphlink.js";
import { n } from "../Utils/@Internal/Types.js";
/** Accessor wrapper which throws an error if one of the base db-requests is still loading. (to be used in Command.Validate functions) */
export declare function GetWait<T>(dataGetterFunc: () => T, options?: Partial<GraphOptions>, funcName?: string): T;
/** reject: caller of "await GetAsync()" receives the error, log: catch error and log it, ignore: catch error */
export declare type GetAsync_ErrorHandleType = "rejectAndLog" | "reject" | "log" | "ignore";
export declare class GetAsync_Options {
    static default: GetAsync_Options;
    /** Just meant to alert us for infinite-loop-like calls/getter-funcs. Default: 100 [pretty arbitrary] */
    maxIterations?: number | undefined;
    /** How to handle errors that occur in accessor, when there are still db-requests in progress. (ie. when accessor is still progressing) */
    errorHandling_during?: GetAsync_ErrorHandleType | undefined;
    /** How to handle errors that occur in accessor, when no db-requests are still in progress. (ie. on final accessor call) */
    errorHandling_final?: GetAsync_ErrorHandleType | undefined;
    /** If true, db requests within dataGetterFunc that find themselves waiting for remote db-data, with throw an error immediately. (avoiding higher-level processing) */
    throwImmediatelyOnDBWait?: boolean | undefined;
}
export declare let GetAsync_throwImmediatelyOnDBWait_activeDepth: number;
export declare function NotifyWaitingForDB(dbPath: string): void;
export declare function GetAsync<T>(dataGetterFunc: () => T, options?: Partial<GraphOptions> & GetAsync_Options): Promise<T>;
export declare type EffectFunc = () => any;
export declare type AddEffect = (effectFunc: EffectFunc) => void;
/** Similar to GetAsync, except includes helper for delaying effect-execution (ie. mobx changes) till end, and without certain data-centric behaviors (like disabling db-cache during resolution). */
export declare function WaitTillResolvedThenExecuteSideEffects({ resolveCondition, effectExecution, timeout, onTimeout, timeoutMessage, }: {
    resolveCondition?: "returns true" | "no bail-error" | "no error" | undefined;
    effectExecution?: "plain" | "action" | undefined;
    timeout?: number | n;
    onTimeout?: "resolve promise" | "reject promise" | "do nothing" | undefined;
    timeoutMessage?: string | undefined;
}, func: (addEffect: AddEffect) => any): Promise<{
    result: any;
    error: any;
    errorHit: boolean;
}>;
export declare let AssertV_triggerDebugger: boolean;
/** Variant of Assert, which does not trigger the debugger. (to be used in mobx-graphlink Command.Validate functions, since it's okay/expected for those to fail asserts) */
export declare function AssertV(condition: any, messageOrMessageFunc?: string | Function | null): asserts condition;
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
    set NonNull(value: NonNullable<any>);
}
/** Helper object for making in-line assertions. */
export declare const AV: AVWrapper;
export declare function NNV<T>(val: T): NonNullable<T>;
export {};

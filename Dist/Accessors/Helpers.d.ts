import { Graphlink } from "../index.js";
import { n } from "../Utils/@Internal/Types.js";
import { BailError } from "../Utils/General/BailManager.js";
export declare enum BailHandling {
    ThrowImmediately = 0,
    ThrowAtEnd_1st = 1,
    CallCustomHandler = 2
}
export declare function MapWithBailHandling<T, T2>(array: T[], mapFunc: (item: T, index: number) => T2, bailHandling?: BailHandling, customBailHandler?: (bailError: BailError, index: number) => any): T2[];
export declare class GetWait_Options {
    static default: GetWait_Options;
    graph: Graphlink<any, any>;
}
/** Accessor wrapper which throws an error if one of the base db-requests is still loading. (to be used in Command.Validate functions) */
export declare function GetWait<T>(dataGetterFunc: () => T, options?: Partial<GetWait_Options>, funcName?: string): T;
/** reject: caller of "await GetAsync()" receives the error, log: catch error and log it, ignore: catch error */
export type GetAsync_ErrorHandleType = "rejectAndLog" | "reject" | "log" | "ignore";
export declare class GetAsync_Options {
    static default: GetAsync_Options;
    graph: Graphlink<any, any>;
    /** Just meant to alert us for infinite-loop-like calls/getter-funcs. Default: 100 [pretty arbitrary] */
    maxIterations?: number | undefined;
    /** How to handle errors that occur in accessor, when there are still db-requests in progress. (ie. when accessor is still progressing) */
    errorHandling_during?: GetAsync_ErrorHandleType;
    /** How to handle errors that occur in accessor, when no db-requests are still in progress. (ie. on final accessor call) */
    errorHandling_final?: GetAsync_ErrorHandleType;
}
export declare function GetAsync<T>(dataGetterFunc: () => T, options?: Partial<GetAsync_Options>): Promise<T>;
export type EffectFunc = () => any;
export type AddEffect = (effectFunc: EffectFunc) => void;
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
    NonNull_<T>(value: T): NonNullable<T>;
    set NonNull(value: NonNullable<any>);
}
/** Helper object for making in-line assertions. */
export declare const AV: AVWrapper;
export declare function NNV<T>(val: T): NonNullable<T>;
export {};

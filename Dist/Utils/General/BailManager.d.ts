import { ArgumentsType } from "updeep/types/types";
import { AccessorCallPlan } from "../../index.js";
export declare class BailError extends Error {
    static createdCount: number;
    /** Gets populated only in some cases (eg. by code in CreateAccessor func) */
    callPlanStack: AccessorCallPlan[];
    constructor(message: string);
    /** We create a new error here (rather than extending the existing), since the "original error" can get thrown from multiple parent-accessors, and we need to build up their call-stacks independently. */
    WithCallPlanStackExtended(callPlan: AccessorCallPlan): BailError;
}
declare global {
    interface Function {
        /** The function itself, unchanged. */
        Normal<Func extends ((..._: any) => any)>(this: Func, ..._: ArgumentsType<Func>): ReturnType<Func>;
        /** Short for "bail if null". (in commands, generally use .NN instead, as bailing is for "still-loading" situations, which the db-accessors already handle) */
        BIN<Func extends ((..._: any) => any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;
        /** Short for "bail if loading-array", ie. emptyArray_loading. */
        BILA<Func extends ((..._: any) => any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;
    }
}
export declare class BailContext {
    onBail_triggerError: boolean;
    onBail_triggerDebugger: boolean;
}
export declare function CatchBail<T, ReturnTypeX>(bailResultOrGetter: T, func: (...args: any[]) => ReturnTypeX, args?: any[], thisArg?: any): NonNullable<ReturnTypeX> | (T extends (() => any) ? ReturnType<T> : T);
export declare let bailContext: BailContext;
export declare function Bail(messageOrMessageFunc?: string | Function | null, triggerDebugger?: boolean): never;
export declare function BailUnless(condition: any, messageOrMessageFunc?: string | Function | null): asserts condition;
export declare const BU: typeof BailUnless;
export declare function BailIfNull<T>(val: T, messageOrMessageFunc?: string | Function | null): NonNullable<T>;
export declare const BIN: typeof BailIfNull;

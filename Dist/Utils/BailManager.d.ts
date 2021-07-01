import { ArgumentsType } from "updeep/types/types";
declare global {
    interface Function {
        /** The function itself, unchanged. */
        normal<Func extends ((..._: any) => any)>(this: Func, ..._: ArgumentsType<Func>): ReturnType<Func>;
        /** Short for "bail if null". */
        BIN<Func extends ((..._: any) => any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;
        /** Short for "bail if loading-array", ie. emptyArray_loading. */
        BILA<Func extends ((..._: any) => any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;
    }
}
export declare class BailContext {
    onBail_triggerError: boolean;
    onBail_triggerDebugger: boolean;
}
export declare let bailContext: BailContext;
export declare function BailUnless(condition: any, messageOrMessageFunc?: string | Function | null): asserts condition;
export declare const BU: typeof BailUnless;
export declare function BailIfNull<T>(val: T, messageOrMessageFunc?: string | Function | null): NonNullable<T>;
export declare const BIN: typeof BailIfNull;

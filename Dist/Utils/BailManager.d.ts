import { ArgumentsType } from "updeep/types/types";
export declare class BailMessage {
    message: string;
    static main: BailMessage;
    constructor(message: string);
}
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
export declare function CatchBail<T, ReturnTypeX>(bailResultOrGetter: T, func: (...args: any[]) => ReturnTypeX): NonNullable<ReturnTypeX> | (T extends (() => any) ? ReturnType<T> : T);
export declare let bailContext: BailContext;
export declare function Bail(messageOrMessageFunc?: string | Function | null, triggerDebugger?: boolean): any;
export declare function BailUnless(condition: any, messageOrMessageFunc?: string | Function | null): asserts condition;
export declare const BU: typeof BailUnless;
export declare function BailIfNull<T>(val: T, messageOrMessageFunc?: string | Function | null): NonNullable<T>;
export declare const BIN: typeof BailIfNull;

import { IAtom } from "mobx";
export type AsyncReturnType<T extends (..._args: any) => Promise<any>> = Awaited<ReturnType<T>>;
export type NonAsyncVersionOfFunc<T extends (..._args: any) => Promise<any>> = (..._args: Parameters<T>) => AsyncReturnType<T>;
export declare class AsyncToObservablePack<T> {
    started: boolean;
    completionEvent: IAtom;
    result: T | undefined;
    startIfNotYet: () => void;
}
/** Warning: Do not reference any mobx-observable fields within the `accessorFunc`; instead, add a second accessor that retrieves that data, then passes them as arguments to the async-accessor. */
export declare function CreateAsyncAccessor<Func extends (...args: any[]) => Promise<any>>(accessorFunc: Func): NonAsyncVersionOfFunc<Func> & {
    Async: (..._: Parameters<Func>) => Promise<Awaited<ReturnType<Func>>>;
    Wait: NonAsyncVersionOfFunc<Func>;
    CatchBail: <T>(bailResultOrGetter: T, ..._: Parameters<Func>) => NonNullable<Awaited<ReturnType<Func>>> | (T extends () => any ? ReturnType<T> : T);
};

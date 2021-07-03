import { GraphOptions, Graphlink } from "../Graphlink.js";
import { RootStoreShape } from "../UserTypes.js";
import { AccessorMetadata } from "./@AccessorMetadata.js";
export declare function WithStore<T>(options: Partial<GraphOptions>, store: any, accessorFunc: () => T): T;
export declare class AccessorOptions {
    static default: AccessorOptions;
    cache: boolean;
    cache_keepAlive: boolean;
    cache_unwrapArrays: boolean;
    /** Short for bail-result. */
    onBail: any;
}
export declare type CallArgToDependencyConvertorFunc = (callArgs: any[]) => any[];
declare type FuncExtensions<Func> = {
    Wait: Func;
    CatchBail: Func extends ((..._: infer Args) => infer ReturnTypeX) ? <T>(bailResultOrGetter: T, ..._: Args) => NonNullable<ReturnTypeX> | (T extends (() => any) ? ReturnType<T> : T) : Func;
    CatchItemBails: Func extends ((..._: infer Args) => infer ReturnTypeX) ? <T>(itemBailResult: T, ..._: Args) => NonNullable<ReturnTypeX> | (T extends (() => any) ? ReturnType<T> : T) : Func;
};
declare type CA_Options<RootState> = Partial<GraphOptions<RootState> & AccessorOptions>;
interface CreateAccessor_Shape<RootState_PreSet = RootStoreShape> {
    <Func extends Function, RootState = RootState_PreSet>(accessorGetter: (context: AccessorContext<RootState>) => Func): Func & FuncExtensions<Func>;
    <Func extends Function, RootState = RootState_PreSet>(options: CA_Options<RootState>, accessorGetter: (context: AccessorContext<RootState>) => Func): Func & FuncExtensions<Func>;
    <Func extends Function, RootState = RootState_PreSet>(name: string, accessorGetter: (context: AccessorContext<RootState>) => Func): Func & FuncExtensions<Func>;
    <Func extends Function, RootState = RootState_PreSet>(name: string, options: CA_Options<RootState>, accessorGetter: (context: AccessorContext<RootState>) => Func): Func & FuncExtensions<Func>;
}
/**
Probably temp. Usage:
export const CreateAccessor_Typed = Create_CreateAccessor_Typed<RootStoreShape>();
export const GetPerson = CreateAccessor_Typed({}, ...);
*/
export declare function Create_CreateAccessor_Typed<RootState>(): CreateAccessor_Shape<RootState>;
export declare class AccessorContext<RootStoreShape> {
    constructor(graph: Graphlink<RootStoreShape, any>);
    graph: Graphlink<RootStoreShape, any>;
    accessorCallStack: AccessorCallStackEntry[];
    get accessorCallStack_current(): AccessorCallStackEntry;
    get store(): RootStoreShape;
    get accessorMeta(): AccessorMetadata;
    get catchItemBails(): boolean;
    get catchItemBails_asX(): any;
    MaybeCatchItemBail<T>(itemGetter: () => T): T;
}
export declare class AccessorCallStackEntry {
    meta: AccessorMetadata;
    catchItemBails: boolean;
    catchItemBails_asX: any;
    _startTime?: number;
}
/**
Wrap a function with CreateAccessor if it's under the "Store/" path, and one of the following:
1) It accesses the store directly (ie. store.main.page). (thus, "WithStore(testStoreContents, ()=>GetThingFromStore())" works, without hacky overriding of project-wide "store" export)
2) It involves "heavy" processing, such that it's worth caching that processing. (rather than use computedFn directly, just standardize on CreateAccessor)
3) It involves a transformation of data into a new wrapper (ie. breaking reference equality), such that it's worth caching the processing. (to not trigger unnecessary child-ui re-renders)
*/
export declare const CreateAccessor: CreateAccessor_Shape;
export {};

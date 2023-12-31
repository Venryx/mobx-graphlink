import { GraphRefs } from "../Graphlink.js";
import { UT_StoreShape } from "../UserTypes.js";
import { AccessorCallPlan } from "./@AccessorCallPlan.js";
import { AccessorOptions } from "./@AccessorMetadata.js";
export declare function WithStore<T>(graphRefs: Partial<GraphRefs>, store: any, accessorFunc: () => T): T;
type FuncExtensions<Func> = {
    Async: Func extends ((..._: infer Args) => infer ReturnTypeX) ? (..._: Args) => Promise<ReturnTypeX> : never;
    Wait: Func;
    CatchBail: Func extends ((..._: infer Args) => infer ReturnTypeX) ? <T>(bailResultOrGetter: T, ..._: Args) => NonNullable<ReturnTypeX> | (T extends (() => any) ? ReturnType<T> : T) : never;
};
interface CreateAccessor_Shape<StoreShape_PreSet = UT_StoreShape> {
    <Func extends (this: AccessorCallPlan | void, ...args: any[]) => any, StoreShape = StoreShape_PreSet>(accessor: Func): Func & FuncExtensions<Func>;
    <Func extends (this: AccessorCallPlan | void, ...args: any[]) => any, StoreShape = StoreShape_PreSet>(options: Partial<AccessorOptions<StoreShape>>, accessor: Func): Func & FuncExtensions<Func>;
    <Func extends (this: AccessorCallPlan | void, ...args: any[]) => any, StoreShape = StoreShape_PreSet>(name: string, accessor: Func): Func & FuncExtensions<Func>;
    <Func extends (this: AccessorCallPlan | void, ...args: any[]) => any, StoreShape = StoreShape_PreSet>(name: string, options: Partial<AccessorOptions<StoreShape>>, accessor: Func): Func & FuncExtensions<Func>;
}
/**
Probably temp. Usage:
export const CreateAccessor_Typed = Create_CreateAccessor_Typed<RootStoreShape>();
export const GetPerson = CreateAccessor_Typed({}, ...);
*/
export declare function Create_CreateAccessor_Typed<StoreShape>(): CreateAccessor_Shape<StoreShape>;
/**
Wrap a function with CreateAccessor if it's under the "Store/" path, and one of the following:
1) It accesses the store directly (ie. store.main.page). (thus, "WithStore(testStoreContents, ()=>GetThingFromStore())" works, without hacky overriding of project-wide "store" export)
2) It involves "heavy" processing, such that it's worth caching that processing. (rather than use computedFn directly, just standardize on CreateAccessor)
3) It involves a transformation of data into a new wrapper (ie. breaking reference equality), such that it's worth caching the processing. (to not trigger unnecessary child-ui re-renders)
*/
export declare const CreateAccessor: CreateAccessor_Shape;
export {};

import { DeepMap } from "mobx-utils/lib/deepMap";
import { IComputedValue, IComputedValueOptions } from "mobx";
export declare const accessorCaches: Map<Function, AccessorCache>;
export declare function GetAccessorCache(accessor: Function, mobxCacheOpts: IComputedValueOptions<any>): AccessorCache;
export declare class AccessorCache {
    constructor(accessor: Function, mobxCacheOpts: IComputedValueOptions<any>);
    accessor: Function;
    mobxCacheOpts: IComputedValueOptions<any>;
    resultCache: DeepMap<IComputedValue<any>>;
    numberOfArgCombinationsCached: number;
    memoWarned: boolean;
    CallAccessor_OrReturnCache(contextVars: any[], callArgs: any[], unwrapArraysForCache?: boolean): any;
}

import { DeepMap } from "mobx-utils/lib/deepMap.js";
import { IComputedValue, IComputedValueOptions } from "mobx";
export declare function LogAccessorRunTimes(): void;
export declare const accessorMetadata: Map<string, AccessorMetadata>;
export declare class AccessorMetadata {
    constructor(data: Partial<AccessorMetadata>);
    name: string;
    accessor: Function;
    _codeStr_cached: string;
    get CodeStr_Cached(): string;
    _canCatchItemBails: boolean;
    get CanCatchItemBails(): boolean;
    nextCall_catchItemBails: boolean;
    nextCall_catchItemBails_asX: any;
    callCount: number;
    totalRunTime: number;
    totalRunTime_asRoot: number;
    mobxCacheOpts: IComputedValueOptions<any>;
    resultCache: DeepMap<IComputedValue<any>>;
    numberOfArgCombinationsCached: number;
    memoWarned: boolean;
    CallAccessor_OrReturnCache(contextVars: any[], callArgs: any[], unwrapArraysForCache?: boolean): any;
}

import { IComputedValueOptions } from "mobx";
import { Graphlink } from "../index.js";
import { UT_StoreShape } from "../UserTypes.js";
import { DeepMap } from "../Utils/General/DeepMap.js";
import { AccessorCallPlan } from "./@AccessorCallPlan.js";
export declare function LogAccessorRunTimes(): void;
export declare class AccessorOptions<RootState = any, DBShape = any> {
    static default: AccessorOptions<any, any>;
    cache: boolean;
    cache_keepAlive: boolean;
    cache_unwrapArrays: boolean;
    graph?: Graphlink<RootState, DBShape>;
}
export declare type CallArgToDependencyConvertorFunc = (callArgs: any[]) => any[];
export declare const accessorMetadata: Map<string, AccessorMetadata>;
export declare class AccessorMetadata {
    constructor(data: Partial<AccessorMetadata>);
    name: string;
    options: AccessorOptions;
    accessor: Function;
    _codeStr_cached: string;
    get CodeStr_Cached(): string;
    _canCatchItemBails: boolean;
    get CanCatchItemBails(): boolean;
    nextCall_catchItemBails: boolean;
    nextCall_catchItemBails_asX: any;
    ResetNextCallFields(): void;
    callCount: number;
    totalRunTime: number;
    mobxCacheOpts: IComputedValueOptions<any>;
    callPlans: DeepMap<AccessorCallPlan>;
    numberOfCallPlansStored: number;
    GetCallPlan(graph: Graphlink<UT_StoreShape, any>, store: UT_StoreShape, catchItemBails: boolean, catchItemBails_asX: any, callArgs: any[], allowCacheGetOrSet: boolean): AccessorCallPlan;
}

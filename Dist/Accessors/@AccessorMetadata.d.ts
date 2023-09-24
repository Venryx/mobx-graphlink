import { IComputedValueOptions, IEqualsComparer } from "mobx";
import { Graphlink } from "../index.js";
import { UT_StoreShape } from "../UserTypes.js";
import { BailError } from "../Utils/General/BailManager.js";
import { DeepMap } from "../Utils/General/DeepMap.js";
import { AccessorCallPlan, CallPlanMeta } from "./@AccessorCallPlan.js";
export declare class AccessorOptions<RootState = any, DBShape = any> {
    static default: AccessorOptions<any, any>;
    graph?: Graphlink<RootState, DBShape>;
    cache: boolean;
    cache_comparer?: IEqualsComparer<any>;
    cache_keepAlive: boolean;
    cache_unwrapArrays: boolean;
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
    profilingInfo: ProfilingInfo;
    madeRawDBAccess: boolean;
    mobxCacheOpts: IComputedValueOptions<any>;
    callPlans: DeepMap<AccessorCallPlan>;
    callPlanMetas: CallPlanMeta[];
    callPlansStored: number;
    GetCallPlan(graph: Graphlink<UT_StoreShape, any>, store: UT_StoreShape, catchItemBails: boolean, catchItemBails_asX: any, callArgs: any[], useCache: boolean): AccessorCallPlan;
}
export declare class ProfilingInfo {
    calls: number;
    calls_cached: number;
    calls_waited: number;
    runTime_sum: number;
    runTime_first: number;
    runTime_min: number;
    runTime_max: number;
    waitTime_sum: number;
    waitTime_first: number;
    waitTime_min: number;
    waitTime_max: number;
    currentWaitTime_startedAt: number | undefined;
    NotifyOfCall(runTime: number, cached: boolean, error: BailError | Error | string): void;
}

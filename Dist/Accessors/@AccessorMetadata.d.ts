import { IComputedValueOptions, IEqualsComparer } from "mobx";
import { Graphlink } from "../index.js";
import { UT_StoreShape } from "../UserTypes.js";
import { BailError } from "../Utils/General/BailManager.js";
import { DeepMap } from "../Utils/General/DeepMap.js";
import { AccessorCallPlan, CallPlanMeta } from "./@AccessorCallPlan.js";
import { n } from "../Utils/@Internal/Types.js";
export declare class AccessorOptions<RootState = any, DBShape = any> {
    static default: AccessorOptions<any, any>;
    graph?: Graphlink<RootState, DBShape>;
    cache: boolean;
    cache_comparer?: IEqualsComparer<any>;
    cache_keepAlive: boolean;
    cache_unwrapArrays: boolean;
    /**
     * Set this field to 1, if (and only if) the accessor needs to access the "accessor context" (technically the `AccessorCallPlan` object),
     * 	for type-safe access to contextual info (eg. the mobx store) that are not available from the passed arguments alone.
     * This flag does not actually change runtime behavior at all; it's used simply to preserve type-data with less fuss (ie. without having to use `as` casts).
     *
     * Example usage (recommended approach):
     * ```const GetUserAge = CreateAccessor({ctx: 1}, function(username: string) { this.store.userAges.get(username); })```
     *
     * Alternative (without using the ctx param; not recommended):
     * ```const GetUserAge = CreateAccessor(function(username: string) { (this as AccessorCallPlan).store.userAges.get(username); })```
     *
     * While using the ctx param is recommended, it does have two drawbacks:
     * * It results in the stripping of param comments/inline-doc-text. (not a problem for me, since I prefer info placed in the function doc-text rather than param doc-text anyway)
     * * It prevents type-inference for params with default-values. (their types can still be marked explicitly though; a bit annoying, but not a big deal, and not needed that often)
     */
    ctx?: 1 | n;
}
export type CallArgToDependencyConvertorFunc = (callArgs: any[]) => any[];
export declare const accessorMetadata: Map<string, AccessorMetadata>;
export declare class AccessorMetadata {
    constructor(data: Partial<AccessorMetadata>);
    name: string;
    id: string;
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
    callPlansCreated: number;
    callPlansActive: number;
    GetCallPlan(graph: Graphlink<UT_StoreShape, any>, store: UT_StoreShape, catchItemBails: boolean, catchItemBails_asX: any, callArgs: any[], useCache: boolean): AccessorCallPlan;
}
export declare class ProfilingInfo {
    calls: number;
    calls_cached: number;
    calls_waited: number;
    overheadTime_sum: number;
    overheadTime_first: number;
    overheadTime_min: number;
    overheadTime_max: number;
    runTime_sum: number;
    runTime_first: number;
    runTime_min: number;
    runTime_max: number;
    waitTime_sum: number;
    waitTime_first: number;
    waitTime_min: number;
    waitTime_max: number;
    currentWaitTime_startedAt: number | undefined;
    NotifyOfCall(runTime: number, overheadTime: number, cached: boolean, error: BailError | Error | string): void;
}

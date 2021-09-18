import { IComputedValue } from "mobx";
import { Graphlink } from "../index.js";
import { UT_StoreShape } from "../UserTypes.js";
import { AccessorMetadata, ProfilingInfo } from "./@AccessorMetadata.js";
export declare class CallPlanMeta {
    constructor(callPlan: AccessorCallPlan);
    index: number;
    argsStr: string;
    profilingInfo: ProfilingInfo;
}
export declare class AccessorCallPlan {
    constructor(accessorMeta: AccessorMetadata, graph: Graphlink<UT_StoreShape, any>, store: UT_StoreShape, catchItemBails: boolean, catchItemBails_asX: any, callArgs: any[], callPlanIndex: number, onUnobserved: () => any);
    accessorMeta: AccessorMetadata;
    graph: Graphlink<UT_StoreShape, any>;
    store: UT_StoreShape;
    catchItemBails: boolean;
    catchItemBails_asX: any;
    callArgs: any[];
    callPlanIndex: number;
    callPlanMeta: CallPlanMeta;
    onUnobserved: () => any;
    GetCacheKey(): any[];
    MaybeCatchItemBail<T>(itemGetter: () => T): T;
    cachedResult_wrapper: IComputedValue<any>;
    Call_OrReturnCache(): any;
}

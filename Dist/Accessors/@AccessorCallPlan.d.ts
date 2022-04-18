import { IComputedValue } from "mobx";
import { Graphlink } from "../index.js";
import { UT_StoreShape } from "../UserTypes.js";
import { AccessorMetadata, ProfilingInfo } from "./@AccessorMetadata.js";
export declare function StringifyDocOrPrimitive(val: any, strForFailure?: string): string;
export declare class CallPlanMeta {
    constructor(callPlan: AccessorCallPlan);
    index: number;
    argsStr: string;
    profilingInfo: ProfilingInfo;
    madeRawDBAccess: boolean;
}
export declare class AccessorCallPlan {
    constructor(accessorMeta: AccessorMetadata, graph: Graphlink<UT_StoreShape, any>, store: UT_StoreShape, catchItemBails: boolean, catchItemBails_asX: any, callArgs: any[], callPlanIndex: number, onUnobserved: () => any);
    accessorMeta: AccessorMetadata;
    graph: Graphlink<UT_StoreShape, any>;
    store: UT_StoreShape;
    catchItemBails: boolean;
    catchItemBails_asX: any;
    callArgs: any[];
    get CallArgs_Unwrapped(): any[];
    callPlanIndex: number;
    callPlanMeta: CallPlanMeta;
    onUnobserved: () => any;
    GetCacheKey(): any[];
    toString(): string;
    cachedResult_wrapper: IComputedValue<any>;
    Call_OrReturnCache(): any;
}

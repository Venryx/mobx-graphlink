import { CE } from "js-vextensions";
//import {DeepMap} from "mobx-utils/lib/deepMap.js";
/*import deepMap_ from "mobx-utils/lib/deepMap.js";
const { DeepMap } = deepMap_; // wrapper for ts-node (eg. init-db scripts)*/
import { DeepMap } from "../Utils/General/DeepMap.js";
import { AccessorCallPlan } from "./@AccessorCallPlan.js";
// profiling
export function LogAccessorRunTimes() {
    const accessorRunTimes_ordered = CE(CE(accessorMetadata).VValues()).OrderByDescending(a => a.totalRunTime);
    //console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a=>a.totalRunTime_asRoot)).Sum()})`);
    console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a => a.callCount)).Sum()})`);
    //Log({}, accessorRunTimes_ordered);
    console.table(accessorRunTimes_ordered);
}
//export class AccessorOptions<T> {
export class AccessorOptions {
    constructor() {
        this.cache = true;
        this.cache_keepAlive = false;
        this.cache_unwrapArrays = true;
        //callArgToDependencyConvertorFunc?: CallArgToDependencyConvertorFunc;
        /** Short for bail-result. */
        //onBail: T;
        //onBail: any;
    }
}
AccessorOptions.default = new AccessorOptions();
export const accessorMetadata = new Map();
export class AccessorMetadata {
    constructor(data) {
        // temp fields
        this.nextCall_catchItemBails = false;
        // profiling
        this.callCount = 0;
        this.totalRunTime = 0;
        //totalRunTime_asRoot = 0;
        // result-caching
        this.mobxCacheOpts = {};
        this.callPlans = new DeepMap();
        this.numberOfCallPlansStored = 0;
        Object.assign(this, data);
    }
    get CodeStr_Cached() {
        var _a;
        this._codeStr_cached = (_a = this._codeStr_cached) !== null && _a !== void 0 ? _a : this.accessor.toString();
        return this._codeStr_cached;
    }
    get CanCatchItemBails() {
        this._canCatchItemBails = this.CodeStr_Cached.includes("catchItemBails") || this.CodeStr_Cached.includes("MaybeCatchItemBail");
        return this._canCatchItemBails;
    }
    ResetNextCallFields() {
        this.nextCall_catchItemBails = false;
        this.nextCall_catchItemBails_asX = undefined;
    }
    GetCallPlan(graph, store, catchItemBails, catchItemBails_asX, callArgs, allowCacheGetOrSet) {
        const callPlan = new AccessorCallPlan(this, graph, store, catchItemBails, catchItemBails_asX, callArgs, this.numberOfCallPlansStored, () => {
            this.callPlans.entry(cacheKey).delete();
        });
        if (!allowCacheGetOrSet)
            return callPlan;
        const cacheKey = callPlan.GetCacheKey();
        const entry = this.callPlans.entry(cacheKey);
        if (!entry.exists()) {
            entry.set(callPlan);
        }
        return entry.get();
    }
}

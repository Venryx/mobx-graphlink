import { BailError } from "../Utils/General/BailManager.js";
//import {DeepMap} from "mobx-utils/lib/deepMap.js";
/*import deepMap_ from "mobx-utils/lib/deepMap.js";
const { DeepMap } = deepMap_; // wrapper for ts-node (eg. init-db scripts)*/
import { DeepMap } from "../Utils/General/DeepMap.js";
import { AccessorCallPlan, CallPlanMeta } from "./@AccessorCallPlan.js";
//export class AccessorOptions<T> {
export class AccessorOptions {
    constructor() {
        //graph: Graphlink<any, any>;
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
        // profiling and such
        this.profilingInfo = new ProfilingInfo();
        //totalRunTime_asRoot = 0;
        this.madeRawDBAccess = false;
        // result-caching
        this.mobxCacheOpts = {};
        this.callPlans = new DeepMap();
        this.callPlanMetas = []; // stored separately, because the meta should be kept even after the call-plan itself is unobserved->destroyed
        this.callPlansStored = 0;
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
    GetCallPlan(graph, store, catchItemBails, catchItemBails_asX, callArgs, useCache) {
        var _a;
        const callPlan_new_index = useCache ? this.callPlansStored : -1;
        const callPlan_new = new AccessorCallPlan(this, graph, store, catchItemBails, catchItemBails_asX, callArgs, callPlan_new_index, () => {
            if (useCache) {
                this.callPlans.entry(cacheKey).delete();
            }
        });
        callPlan_new.callPlanMeta = (_a = this.callPlanMetas[callPlan_new.callPlanIndex]) !== null && _a !== void 0 ? _a : new CallPlanMeta(callPlan_new);
        if (!useCache)
            return callPlan_new;
        const cacheKey = callPlan_new.GetCacheKey();
        const entry = this.callPlans.entry(cacheKey);
        if (!entry.exists()) {
            entry.set(callPlan_new);
            this.callPlanMetas[callPlan_new_index] = callPlan_new.callPlanMeta;
            this.callPlansStored++;
        }
        return entry.get();
    }
}
export class ProfilingInfo {
    constructor() {
        this.calls = 0;
        this.calls_cached = 0;
        this.calls_waited = 0;
        this.runTime_sum = 0;
        this.runTime_first = 0;
        this.runTime_min = 0;
        this.runTime_max = 0;
        this.waitTime_sum = 0;
        this.waitTime_first = 0;
        this.waitTime_min = 0;
        this.waitTime_max = 0;
    }
    NotifyOfCall(runTime, cached, error) {
        let waitTime = 0;
        const waitActiveFromLastCall = this.currentWaitTime_startedAt != null;
        if (waitActiveFromLastCall) {
            waitTime = performance.now() - this.currentWaitTime_startedAt;
            this.currentWaitTime_startedAt = undefined;
        }
        if (error instanceof BailError) {
            this.currentWaitTime_startedAt = performance.now();
        }
        this.calls++;
        if (cached)
            this.calls_cached++;
        if (waitActiveFromLastCall)
            this.calls_waited++;
        this.runTime_sum += runTime;
        if (this.calls == 1)
            this.runTime_first = runTime;
        this.runTime_min = this.calls == 1 ? runTime : Math.min(runTime, this.runTime_min);
        this.runTime_max = this.calls == 1 ? runTime : Math.max(runTime, this.runTime_max);
        // probably todo: change to the type of approach below (where only non-cached calls are included for metric calculation)
        /*if (calls_nonCached == 1) this.runTime_nonCached_first = runTime;
        this.runTime_nonCached_min = calls_nonCached == 1 ? runTime : Math.min(runTime, this.runTime_nonCached_min);
        this.runTime_nonCached_max = this.calls == 1 ? runTime : Math.max(runTime, this.runTime_nonCached_max);*/
        this.waitTime_sum += waitTime;
        if (this.calls_waited == 1)
            this.waitTime_first = waitTime;
        this.waitTime_min = this.calls_waited == 1 ? waitTime : Math.min(waitTime, this.waitTime_min);
        this.waitTime_max = this.calls_waited == 1 ? waitTime : Math.max(waitTime, this.waitTime_max);
    }
}

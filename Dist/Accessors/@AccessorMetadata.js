import { BailMessage } from "../Utils/General/BailManager.js";
//import {DeepMap} from "mobx-utils/lib/deepMap.js";
/*import deepMap_ from "mobx-utils/lib/deepMap.js";
const { DeepMap } = deepMap_; // wrapper for ts-node (eg. init-db scripts)*/
import { DeepMap } from "../Utils/General/DeepMap.js";
import { AccessorCallPlan, CallPlanMeta } from "./@AccessorCallPlan.js";
//export class AccessorOptions<T> {
export class AccessorOptions {
    constructor() {
        Object.defineProperty(this, "cache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "cache_keepAlive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "cache_unwrapArrays", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        //callArgToDependencyConvertorFunc?: CallArgToDependencyConvertorFunc;
        /** Short for bail-result. */
        //onBail: T;
        //onBail: any;
    }
}
Object.defineProperty(AccessorOptions, "default", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new AccessorOptions()
});
export const accessorMetadata = new Map();
export class AccessorMetadata {
    constructor(data) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "accessor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // inspection of func-code
        Object.defineProperty(this, "_codeStr_cached", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_canCatchItemBails", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // temp fields
        Object.defineProperty(this, "nextCall_catchItemBails", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "nextCall_catchItemBails_asX", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // profiling and such
        Object.defineProperty(this, "profilingInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ProfilingInfo()
        });
        //totalRunTime_asRoot = 0;
        Object.defineProperty(this, "madeRawDBAccess", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        // result-caching
        Object.defineProperty(this, "mobxCacheOpts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "callPlans", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new DeepMap()
        });
        Object.defineProperty(this, "callPlanMetas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        }); // stored separately, because the meta should be kept even after the call-plan itself is unobserved->destroyed
        Object.defineProperty(this, "callPlansStored", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
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
        Object.defineProperty(this, "calls", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "calls_cached", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "calls_waited", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "runTime_sum", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "runTime_first", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "runTime_min", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "runTime_max", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "waitTime_sum", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "waitTime_first", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "waitTime_min", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "waitTime_max", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "currentWaitTime_startedAt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
    NotifyOfCall(runTime, cached, error) {
        let waitTime = 0;
        const waitActiveFromLastCall = this.currentWaitTime_startedAt != null;
        if (waitActiveFromLastCall) {
            waitTime = performance.now() - this.currentWaitTime_startedAt;
            this.currentWaitTime_startedAt = undefined;
        }
        if (error instanceof BailMessage) {
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

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
        // profiling
        Object.defineProperty(this, "callCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "totalRunTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        //totalRunTime_asRoot = 0;
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
    GetCallPlan(graph, store, catchItemBails, catchItemBails_asX, callArgs, allowPersist) {
        var _a;
        const callPlan_new_index = allowPersist ? this.callPlansStored : -1;
        const callPlan_new = new AccessorCallPlan(this, graph, store, catchItemBails, catchItemBails_asX, callArgs, callPlan_new_index, () => {
            if (allowPersist) {
                this.callPlans.entry(cacheKey).delete();
            }
        });
        callPlan_new.callPlanMeta = (_a = this.callPlanMetas[callPlan_new.callPlanIndex]) !== null && _a !== void 0 ? _a : new CallPlanMeta(callPlan_new);
        if (!allowPersist)
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

import { IsPrimitive } from "js-vextensions";
import { computed, onBecomeUnobserved, _isComputingDerivation } from "mobx";
import { CatchBail } from "../index.js";
import { ProfilingInfo } from "./@AccessorMetadata.js";
export function StringifyDocOrPrimitive(val, strForFailure = "?") {
    if (IsPrimitive(val))
        return JSON.stringify(val);
    if (val == null)
        return JSON.stringify(null);
    if (val.id)
        return JSON.stringify({ id: val.id });
    return strForFailure;
}
export class CallPlanMeta {
    constructor(callPlan) {
        Object.defineProperty(this, "index", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "argsStr", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "profilingInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new ProfilingInfo()
        });
        Object.defineProperty(this, "madeRawDBAccess", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.index = callPlan.callPlanIndex;
        this.argsStr = callPlan.callArgs.map(arg => StringifyDocOrPrimitive(arg)).join(", ");
    }
}
export class AccessorCallPlan {
    constructor(accessorMeta, graph, store, catchItemBails, catchItemBails_asX, callArgs, callPlanIndex, onUnobserved) {
        // core properties (those which make up the call-context's identity)
        // context args
        Object.defineProperty(this, "accessorMeta", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // not needed as part of cache-key though (since these call-context entries are already linked to the accessor-meta, by being stored on it)
        Object.defineProperty(this, "graph", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "store", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "catchItemBails", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "catchItemBails_asX", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // call args
        Object.defineProperty(this, "callArgs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // internal helpers
        Object.defineProperty(this, "callPlanIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "callPlanMeta", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "onUnobserved", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // dynamic
        Object.defineProperty(this, "cachedResult_wrapper", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.accessorMeta = accessorMeta;
        this.graph = graph;
        this.store = store;
        this.catchItemBails = catchItemBails;
        this.catchItemBails_asX = catchItemBails_asX;
        this.callArgs = callArgs;
        this.callPlanIndex = callPlanIndex;
        this.onUnobserved = onUnobserved;
    }
    get CallArgs_Unwrapped() {
        let callArgs_unwrapped = this.callArgs;
        if (this.accessorMeta.options.cache_unwrapArrays) {
            //Assert(options.cache, "There is no point to unwrapping-args if caching is disabled.");
            for (const [argIndex, callArg] of this.callArgs.entries()) {
                if (!Array.isArray(callArg))
                    continue;
                // make sure we're not modifying the passed in callArgs array
                if (callArgs_unwrapped == this.callArgs)
                    callArgs_unwrapped = this.callArgs.slice();
                callArgs_unwrapped.splice(argIndex, 1, "$ARRAY_ITEMS_START", ...callArg, "$ARRAY_ITEMS_END");
            }
        }
        ;
        return callArgs_unwrapped;
    }
    GetCacheKey() {
        const contextArgs = [
            this.graph,
            this.store,
            this.catchItemBails,
            this.catchItemBails_asX,
        ];
        let callArgs_unwrapped = this.CallArgs_Unwrapped;
        return [...contextArgs, ...callArgs_unwrapped];
    }
    toString() {
        return JSON.stringify({
            contextArgs: {
                catchItemBails: this.catchItemBails,
                catchItemBails_asX: this.catchItemBails_asX,
            },
            callArgs_unwrapped: this.CallArgs_Unwrapped.map(a => StringifyDocOrPrimitive(a)),
        });
    }
    // helpers for user/in-accessor code
    MaybeCatchItemBail(itemGetter) {
        if (this.catchItemBails) {
            return CatchBail(this.catchItemBails_asX, itemGetter);
        }
        return itemGetter();
    }
    //uselessCachingWarned = false;
    //_lastCall_startTime?: number; // for debugging/profiling purposes only
    Call_OrReturnCache() {
        var _a;
        // cache hit, return
        if (this.cachedResult_wrapper != null) {
            return this.cachedResult_wrapper.get();
        }
        //this.graph.lastRunAccessor_meta = this.accessorMeta; // run after cache-hit check (if mere cache-hit, the accessor's code was not actually run)
        const cachingHasPurpose = _isComputingDerivation() || this.accessorMeta.options.cache_keepAlive; // caching does not have purpose unless we're in a reactive context, or user has specified it as purposeful
        //const useCaching = cachingHasPurpose && this.accessorMeta.options.cache;
        const useCaching = cachingHasPurpose;
        if (!useCaching) {
            /*if (!cachingHasPurpose && !this.uselessCachingWarned) {
                console.warn("invoking a computedFn from outside an reactive context won't be memoized, unless keepAlive is set");
                this.uselessCachingWarned = true;
            }*/
            return this.accessorMeta.accessor.apply(this, this.callArgs);
        }
        // create new entry
        this.cachedResult_wrapper = computed(() => this.accessorMeta.accessor.apply(this, this.callArgs), {
            name: `computedFn(${this.accessorMeta.accessor.name}#${++this.callPlanIndex})`,
            keepAlive: (_a = this.accessorMeta.options.cache_keepAlive) !== null && _a !== void 0 ? _a : false,
        });
        // if/when the cached-result-wrapper becomes no-longer-observed, also clean up this call-plan object
        if (!this.accessorMeta.options.cache_keepAlive) {
            onBecomeUnobserved(this.cachedResult_wrapper, this.onUnobserved);
        }
        // return current val
        return this.cachedResult_wrapper.get();
    }
}

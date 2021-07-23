import { computed, onBecomeUnobserved, _isComputingDerivation } from "mobx";
import { CatchBail } from "../index.js";
export class AccessorCallPlan {
    constructor(accessorMeta, graph, store, catchItemBails, catchItemBails_asX, callArgs, callPlanIndex, onUnobserved) {
        this.accessorMeta = accessorMeta;
        this.graph = graph;
        this.store = store;
        this.catchItemBails = catchItemBails;
        this.catchItemBails_asX = catchItemBails_asX;
        this.callArgs = callArgs;
        this.callPlanIndex = callPlanIndex;
        this.onUnobserved = onUnobserved;
    }
    GetCacheKey() {
        const contextArgs = [
            this.graph,
            this.store,
            this.catchItemBails,
            this.catchItemBails_asX,
        ];
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
        return [...contextArgs, ...callArgs_unwrapped];
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
        this.graph.lastRunAccessor_meta = this.accessorMeta; // run after cache-hit check (if mere cache-hit, the accessor's code was not actually run)
        const cachingHasPurpose = !_isComputingDerivation() || this.accessorMeta.options.cache_keepAlive; // caching does not have purpose unless we're in a reactive context, or user has specified it as purposeful
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
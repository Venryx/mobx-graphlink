import { CatchBail } from "../index.js";
export class AccessorCallPlan {
    constructor(accessorMeta, graph, store, catchItemBails, catchItemBails_asX, callArgs) {
        // extras
        this.mobxCacheOpts = {};
        this.memoWarned = false;
        this.accessorMeta = accessorMeta;
        this.graph = graph;
        this.store = store;
        this.catchItemBails = catchItemBails;
        this.catchItemBails_asX = catchItemBails_asX;
        this.callArgs = callArgs;
    }
    // helpers
    MaybeCatchItemBail(itemGetter) {
        if (this.catchItemBails) {
            return CatchBail(this.catchItemBails_asX, itemGetter);
        }
        return itemGetter();
    }
    Call_OrReturnCache(callArgs, allowCachingThisTime = true) {
        const cacheKey = [...contextVars, ...callArgs_unwrapped];
        const cacheEntry = this.callContexts.entry(cacheKey);
        // cache hit, return
        if (cacheEntry.exists())
            return cacheEntry.get().get();
        // if function is invoked, and its a cache miss without reactive, there is no point in caching...
        if (!this.mobxCacheOpts.keepAlive && !_isComputingDerivation()) {
            if (!this.memoWarned) {
                console.warn("invoking a computedFn from outside an reactive context won't be memoized, unless keepAlive is set");
                this.memoWarned = true;
            }
            return this.accessor.apply(null, callArgs);
        }
        // create new entry
        const cachedValue_wrapper = computed(() => this.accessor.apply(null, callArgs), Object.assign(Object.assign({}, this.mobxCacheOpts), { name: `computedFn(${this.accessor.name}#${++this.numberOfArgCombinationsCached})` }));
        cacheEntry.set(cachedValue_wrapper);
        // clean up if/when no longer observed
        if (!this.mobxCacheOpts.keepAlive) {
            onBecomeUnobserved(cachedValue_wrapper, () => this.callContexts.entry(cacheKey).delete());
        }
        // return current val
        return cachedValue_wrapper.get();
    }
}

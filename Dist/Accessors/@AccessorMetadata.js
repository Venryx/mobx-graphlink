import { CE } from "js-vextensions";
import { computed, onBecomeUnobserved, _isComputingDerivation } from "mobx";
// profiling
export function LogAccessorRunTimes() {
    const accessorRunTimes_ordered = CE(CE(accessorMetadata).VValues()).OrderByDescending(a => a.totalRunTime);
    console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a => a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a => a.totalRunTime_asRoot)).Sum()})`);
    //Log({}, accessorRunTimes_ordered);
    console.table(accessorRunTimes_ordered);
}
export const accessorMetadata = new Map();
export class AccessorMetadata {
    constructor(data) {
        // temp fields
        this.nextCall_catchItemBails = false;
        // profiling
        this.callCount = 0;
        this.totalRunTime = 0;
        this.totalRunTime_asRoot = 0;
        this.numberOfArgCombinationsCached = 0;
        this.memoWarned = false;
        Object.assign(this, data);
        this.codeStr_cached = this.accessor.toString();
        this.canCatchItemBails = this.codeStr_cached.includes("catchItemBails") || this.codeStr_cached.includes("MaybeCatchItemBail");
    }
    CallAccessor_OrReturnCache(contextVars, callArgs, unwrapArraysForCache = true) {
        let callArgs_unwrapped = callArgs;
        if (unwrapArraysForCache) {
            //Assert(options.cache, "There is no point to unwrapping-args if caching is disabled.");
            //for (const argIndex of options.cache_unwrapArgs.Pairs().map(a=>a.keyNum)) {
            //callArgs_unwrapped = callArgs.slice();
            for (const [argIndex, callArg] of callArgs.entries()) {
                if (!Array.isArray(callArg))
                    continue;
                // make sure we're not modifying the passed in callArgs array
                if (callArgs_unwrapped == callArgs)
                    callArgs_unwrapped = callArgs.slice();
                callArgs_unwrapped.splice(argIndex, 1, "$ARRAY_ITEMS_START", ...callArg, "$ARRAY_ITEMS_END");
                //callArg_unwrapLengths[argIndex] = unwrappedValuesForCallArg.length;
            }
        }
        const cacheKey = [...contextVars, ...callArgs_unwrapped];
        const cacheEntry = this.resultCache.entry(cacheKey);
        // cache hit, return
        if (cacheEntry.exists())
            return cacheEntry.get().get();
        // if function is invoked, and its a cache miss without reactive, there is no point in caching...
        if (!this.mobxCacheOpts.keepAlive && !_isComputingDerivation()) {
            if (!this.memoWarned) {
                console.warn("invoking a computedFn from outside an reactive context won't be memoized, unless keepAlive is set");
                this.memoWarned = true;
            }
            return this.accessor.apply(self, callArgs);
        }
        // create new entry
        const cachedValue_wrapper = computed(() => this.accessor.apply(self, callArgs), Object.assign(Object.assign({}, this.mobxCacheOpts), { name: `computedFn(${this.accessor.name}#${++this.numberOfArgCombinationsCached})` }));
        cacheEntry.set(cachedValue_wrapper);
        // clean up if/when no longer observed
        if (!this.mobxCacheOpts.keepAlive) {
            onBecomeUnobserved(cachedValue_wrapper, () => this.resultCache.entry(cacheKey).delete());
        }
        // return current val
        return cachedValue_wrapper.get();
    }
}

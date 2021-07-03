import { DeepMap } from "mobx-utils/lib/deepMap";
import {IComputedValue,IComputedValueOptions, computed, onBecomeUnobserved, _isComputingDerivation, isAction} from "mobx"

export const accessorCaches = new Map<Function, AccessorCache>();
export function GetAccessorCache(accessor: Function, mobxCacheOpts: IComputedValueOptions<any>) {
	if (!accessorCaches.has(accessor)) {
		accessorCaches.set(accessor, new AccessorCache(accessor, mobxCacheOpts));
	}
	return accessorCaches.get(accessor)!;
}

export class AccessorCache {
	constructor(accessor: Function, mobxCacheOpts: IComputedValueOptions<any>) {
		this.accessor = accessor;
		this.mobxCacheOpts = mobxCacheOpts;
	}

	accessor: Function;
	mobxCacheOpts: IComputedValueOptions<any>;

	resultCache: DeepMap<IComputedValue<any>>;
   numberOfArgCombinationsCached = 0
	memoWarned = false;

	/*private GetCacheEntryForArgs(args: any[]) {
		return this.resultCache.entry(args);
	}*/
	CallAccessor_OrReturnCache(contextVars: any[], callArgs: any[], unwrapArraysForCache = true) {
		let callArgs_unwrapped = callArgs;
		if (unwrapArraysForCache) {
			//Assert(options.cache, "There is no point to unwrapping-args if caching is disabled.");
			//for (const argIndex of options.cache_unwrapArgs.Pairs().map(a=>a.keyNum)) {
			//callArgs_unwrapped = callArgs.slice();
			for (const [argIndex, callArg] of callArgs.entries()) {
				if (!Array.isArray(callArg)) continue;

				// make sure we're not modifying the passed in callArgs array
				if (callArgs_unwrapped == callArgs) callArgs_unwrapped = callArgs.slice();

				callArgs_unwrapped.splice(argIndex, 1, "$ARRAY_ITEMS_START", ...callArg, "$ARRAY_ITEMS_END");
				//callArg_unwrapLengths[argIndex] = unwrappedValuesForCallArg.length;
			}
		}

		const cacheKey = [...contextVars, ...callArgs_unwrapped];
		const cacheEntry = this.resultCache.entry(cacheKey);
		// cache hit, return
		if (cacheEntry.exists()) return cacheEntry.get().get();

		// if function is invoked, and its a cache miss without reactive, there is no point in caching...
		if (!this.mobxCacheOpts.keepAlive && !_isComputingDerivation()) {
			if (!this.memoWarned) {
				console.warn("invoking a computedFn from outside an reactive context won't be memoized, unless keepAlive is set");
				this.memoWarned = true;
			}
			return this.accessor.apply(self, callArgs);
	 	}
		// create new entry
		const cachedValue_wrapper = computed(()=>this.accessor.apply(self, callArgs), {
			...this.mobxCacheOpts,
			name: `computedFn(${this.accessor.name}#${++this.numberOfArgCombinationsCached})`
		});
	 	cacheEntry.set(cachedValue_wrapper);

		// clean up if/when no longer observed
		if (!this.mobxCacheOpts.keepAlive) {
			onBecomeUnobserved(cachedValue_wrapper, ()=>this.resultCache.entry(cacheKey).delete());
		}

		// return current val
		return cachedValue_wrapper.get();
	}
}
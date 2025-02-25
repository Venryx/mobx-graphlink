import {IsPrimitive} from "js-vextensions";
import {comparer, computed, IComputedValue, IComputedValueOptions, onBecomeUnobserved, _isComputingDerivation} from "mobx";
import {Graphlink, CatchBail} from "../index.js";
import {UT_StoreShape} from "../UserTypes.js";
import {AccessorMetadata, ProfilingInfo} from "./@AccessorMetadata.js";

export function StringifyDocOrPrimitive(val: any, strForFailure = "?") {
	if (IsPrimitive(val)) return JSON.stringify(val);
	if (val == null) return JSON.stringify(null);
	if (val.id) return JSON.stringify({id: val.id});
	return strForFailure;
}

export class CallPlanMeta {
	constructor(callPlan: AccessorCallPlan) {
		this.index = callPlan.callPlanIndex;
		this.argsStr = callPlan.callArgs.map(arg=>StringifyDocOrPrimitive(arg)).join(", ");
	}

	index: number;
	argsStr: string;
	profilingInfo = new ProfilingInfo();
	madeRawDBAccess = false;
}

export class AccessorCallPlan {
	constructor(
		accessorMeta: AccessorMetadata,
		graph: Graphlink<UT_StoreShape, any>,
		store: UT_StoreShape,
		catchItemBails: boolean,
		catchItemBails_asX: any,
		callArgs: any[],
		callPlanIndex: number,
		onUnobserved: ()=>any,
	) {
		this.accessorMeta = accessorMeta;
		this.graph = graph;
		this.store = store;
		this.catchItemBails = catchItemBails;
		this.catchItemBails_asX = catchItemBails_asX;
		this.callArgs = callArgs;
		this.callPlanIndex = callPlanIndex;
		this.onUnobserved = onUnobserved;
	}

	// core properties (those which make up the call-context's identity)
	// context args
	accessorMeta: AccessorMetadata; // not needed as part of cache-key though (since these call-context entries are already linked to the accessor-meta, by being stored on it)
	graph: Graphlink<UT_StoreShape, any>;
	store: UT_StoreShape;
	catchItemBails: boolean;
	catchItemBails_asX: any;
	// call args
	callArgs: any[];
	get CallArgs_Unwrapped() {
		let callArgs_unwrapped = this.callArgs;
		if (this.accessorMeta.options.cache_unwrapArrays) {
			//Assert(options.cache, "There is no point to unwrapping-args if caching is disabled.");
			// iterate in reverse order, so that we can modify the array in-place without affecting the indexes of the items we still need to unwrap
			for (let argIndex = this.callArgs.length - 1; argIndex >= 0; argIndex--) {
				const callArg = this.callArgs[argIndex];
				if (!Array.isArray(callArg)) continue;

				// make sure we're not modifying the passed in callArgs array
				if (callArgs_unwrapped == this.callArgs) callArgs_unwrapped = this.callArgs.slice();

				callArgs_unwrapped.splice(argIndex, 1, "$ARRAY_ITEMS_START", ...callArg, "$ARRAY_ITEMS_END");
			}
		}
		return callArgs_unwrapped;
	}

	// internal helpers
	callPlanIndex: number;
	callPlanMeta: CallPlanMeta;
	onUnobserved: ()=>any;
	GetCacheKey() {
		const contextArgs = [
			this.graph,
			this.store,
			/*this.catchItemBails,
			this.catchItemBails_asX,*/
		];
		const callArgs_unwrapped = this.CallArgs_Unwrapped;
		return [...contextArgs, ...callArgs_unwrapped];
	}
	toString() {
		return JSON.stringify({
			contextArgs: {
				/*catchItemBails: this.catchItemBails,
				catchItemBails_asX: this.catchItemBails_asX,*/
			},
			callArgs_unwrapped: this.CallArgs_Unwrapped.map(a=>StringifyDocOrPrimitive(a)),
		});
	}

	// helpers for user/in-accessor code
	/*MaybeCatchItemBail<T>(itemGetter: ()=>T): T {
		if (this.catchItemBails) {
			return CatchBail(this.catchItemBails_asX, itemGetter);
		}
		return itemGetter();
	}*/
	// for newer alternative, see MapWithBailHandling()

	// dynamic
	cachedResult_wrapper: IComputedValue<any>;
	//uselessCachingWarned = false;
	//_lastCall_startTime?: number; // for debugging/profiling purposes only
	Call_OrReturnCache() {
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
		this.cachedResult_wrapper = computed(()=>this.accessorMeta.accessor.apply(this, this.callArgs), {
			name: `computedFn(${this.accessorMeta.name}#${++this.callPlanIndex})`,
			keepAlive: this.accessorMeta.options.cache_keepAlive ?? false,
			equals: this.accessorMeta.options.cache_comparer ?? undefined,
		});
		// if/when the cached-result-wrapper becomes no-longer-observed, also clean up this call-plan object
		if (!this.accessorMeta.options.cache_keepAlive) {
			onBecomeUnobserved(this.cachedResult_wrapper, this.onUnobserved);
		}

		// return current val
		return this.cachedResult_wrapper.get();
	}
}
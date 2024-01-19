import {CE} from "js-vextensions";
import {IComputedValue, IComputedValueOptions, computed, onBecomeUnobserved, _isComputingDerivation, onBecomeObserved, comparer, IEqualsComparer} from "mobx";
import {Graphlink} from "../index.js";
import {UT_StoreShape} from "../UserTypes.js";
import {BailError} from "../Utils/General/BailManager.js";

//import {DeepMap} from "mobx-utils/lib/deepMap.js";
/*import deepMap_ from "mobx-utils/lib/deepMap.js";
const { DeepMap } = deepMap_; // wrapper for ts-node (eg. init-db scripts)*/
import {DeepMap} from "../Utils/General/DeepMap.js";
import {AccessorCallPlan, CallPlanMeta} from "./@AccessorCallPlan.js";
import {n} from "../Utils/@Internal/Types.js";

//export class AccessorOptions<T> {
export class AccessorOptions<RootState = any, DBShape = any> {
	static default = new AccessorOptions();

	// fields from GraphRefs
	declare graph?: Graphlink<RootState, DBShape>;
	//graph: Graphlink<any, any>;

	cache = true;
	cache_comparer?: IEqualsComparer<any>;
	cache_keepAlive = false;
	cache_unwrapArrays = true;
	//callArgToDependencyConvertorFunc?: CallArgToDependencyConvertorFunc;

	/**
	 * Set this field to 1, if (and only if) the accessor needs to access the "accessor context" (technically the `AccessorCallPlan` object),
	 * 	for type-safe access to contextual info (eg. the mobx store) that are not available from the passed arguments alone.
	 * This flag does not actually change runtime behavior at all; it's used simply to preserve type-data with less fuss (ie. without having to use `as` casts).
	 * 
	 * Example usage (recommended approach):  
	 * ```const GetUserAge = CreateAccessor({ctx: 1}, function(username: string) { this.store.userAges.get(username); })```
	 * 
	 * Alternative (without using the ctx param; not recommended):  
	 * ```const GetUserAge = CreateAccessor(function(username: string) { (this as AccessorCallPlan).store.userAges.get(username); })```
	 * 
	 * While using the ctx param is recommended, it does have two drawbacks:
	 * * It results in the stripping of param comments/inline-doc-text. (not a problem for me, since I prefer info placed in the function doc-text rather than param doc-text anyway)
	 * * It prevents type-inference for params with default-values. (their types can still be marked explicitly though; a bit annoying, but not a big deal, and not needed that often)
	 */
	declare ctx?: 1|n;

	/** Short for bail-result. */
	//onBail: T;
	//onBail: any;
}
export type CallArgToDependencyConvertorFunc = (callArgs: any[])=>any[];

export const accessorMetadata = new Map<string, AccessorMetadata>();
export class AccessorMetadata {
	constructor(data: Partial<AccessorMetadata>) {
		Object.assign(this, data);
	}
	name: string;
	id: string;
	options: AccessorOptions;
	accessor: Function;

	// inspection of func-code
	_codeStr_cached: string;
	get CodeStr_Cached() {
		this._codeStr_cached = this._codeStr_cached ?? this.accessor.toString();
		return this._codeStr_cached;
	}
	_canCatchItemBails: boolean;
	get CanCatchItemBails() {
		this._canCatchItemBails = this.CodeStr_Cached.includes("catchItemBails") || this.CodeStr_Cached.includes("MaybeCatchItemBail");
		return this._canCatchItemBails;
	}

	// temp fields
	nextCall_catchItemBails = false;
	nextCall_catchItemBails_asX: any;
	ResetNextCallFields() {
		this.nextCall_catchItemBails = false;
		this.nextCall_catchItemBails_asX = undefined;
	}

	// profiling and such
	profilingInfo = new ProfilingInfo();
	//totalRunTime_asRoot = 0;
	madeRawDBAccess = false;

	// result-caching
	mobxCacheOpts: IComputedValueOptions<any> = {};
	callPlans = new DeepMap<AccessorCallPlan>();
	callPlanMetas = [] as CallPlanMeta[]; // stored separately, because the meta should be kept even after the call-plan itself is unobserved->destroyed
	callPlansCreated = 0; // todo: maybe remove this (could use callPlanMetas.length instead)
	callPlansActive = 0;
	GetCallPlan(graph: Graphlink<UT_StoreShape, any>, store: UT_StoreShape, catchItemBails: boolean, catchItemBails_asX: any, callArgs: any[], useCache: boolean) {
		const callPlan_new_index = useCache ? this.callPlansCreated : -1;
		const callPlan_new = new AccessorCallPlan(this, graph, store, catchItemBails, catchItemBails_asX, callArgs, callPlan_new_index, ()=>{
			if (useCache) {
				this.callPlans.entry(cacheKey).delete();
				this.callPlansActive--;
			}
		});
		callPlan_new.callPlanMeta = this.callPlanMetas[callPlan_new.callPlanIndex] ?? new CallPlanMeta(callPlan_new);
		if (!useCache) return callPlan_new;

		const cacheKey = callPlan_new.GetCacheKey();
		const entry = this.callPlans.entry(cacheKey);
		if (!entry.exists()) {
			entry.set(callPlan_new);
			this.callPlanMetas[callPlan_new_index] = callPlan_new.callPlanMeta;
			this.callPlansCreated++;
			this.callPlansActive++;
		}
		return entry.get();
	}
}

export class ProfilingInfo {
	calls = 0;
	calls_cached = 0;
	calls_waited = 0;

	runTime_sum = 0;
	runTime_first = 0;
	runTime_min = 0;
	runTime_max = 0;

	waitTime_sum = 0;
	waitTime_first = 0;
	waitTime_min = 0;
	waitTime_max = 0;

	currentWaitTime_startedAt: number|undefined;
	NotifyOfCall(runTime: number, cached: boolean, error: BailError | Error | string) {
		let waitTime = 0;
		const waitActiveFromLastCall = this.currentWaitTime_startedAt != null;
		if (waitActiveFromLastCall) {
			waitTime = performance.now() - this.currentWaitTime_startedAt!;
			this.currentWaitTime_startedAt = undefined;
		}
		if (error instanceof BailError) {
			this.currentWaitTime_startedAt = performance.now();
		}

		this.calls++;
		if (cached) this.calls_cached++;
		if (waitActiveFromLastCall) this.calls_waited++;

		this.runTime_sum += runTime;
		if (this.calls == 1) this.runTime_first = runTime;
		this.runTime_min = this.calls == 1 ? runTime : Math.min(runTime, this.runTime_min);
		this.runTime_max = this.calls == 1 ? runTime : Math.max(runTime, this.runTime_max);
		// probably todo: change to the type of approach below (where only non-cached calls are included for metric calculation)
		/*if (calls_nonCached == 1) this.runTime_nonCached_first = runTime;
		this.runTime_nonCached_min = calls_nonCached == 1 ? runTime : Math.min(runTime, this.runTime_nonCached_min);
		this.runTime_nonCached_max = this.calls == 1 ? runTime : Math.max(runTime, this.runTime_nonCached_max);*/

		this.waitTime_sum += waitTime;
		if (this.calls_waited == 1) this.waitTime_first = waitTime;
		this.waitTime_min = this.calls_waited == 1 ? waitTime : Math.min(waitTime, this.waitTime_min);
		this.waitTime_max = this.calls_waited == 1 ? waitTime : Math.max(waitTime, this.waitTime_max);
	}
}
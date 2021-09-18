import {CE} from "js-vextensions";
import {IComputedValue, IComputedValueOptions, computed, onBecomeUnobserved, _isComputingDerivation, onBecomeObserved} from "mobx"
import {Graphlink} from "../index.js";
import {UT_StoreShape} from "../UserTypes.js";

//import {DeepMap} from "mobx-utils/lib/deepMap.js";
/*import deepMap_ from "mobx-utils/lib/deepMap.js";
const { DeepMap } = deepMap_; // wrapper for ts-node (eg. init-db scripts)*/
import {DeepMap} from "../Utils/General/DeepMap.js";
import {AccessorCallPlan, CallPlanMeta} from "./@AccessorCallPlan.js";

//export class AccessorOptions<T> {
export class AccessorOptions<RootState = any, DBShape = any> {
	static default = new AccessorOptions();
	cache = true;
	cache_keepAlive = false;
	cache_unwrapArrays = true;
	declare graph?: Graphlink<RootState, DBShape>;
	//callArgToDependencyConvertorFunc?: CallArgToDependencyConvertorFunc;

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

	// profiling
	callCount = 0;
	totalRunTime = 0;
	//totalRunTime_asRoot = 0;

	// result-caching
	mobxCacheOpts: IComputedValueOptions<any> = {};
	callPlans = new DeepMap<AccessorCallPlan>();
	callPlanMetas = [] as CallPlanMeta[]; // stored separately, because the meta should be kept even after the call-plan itself is unobserved->destroyed
   callPlansStored = 0;
   GetCallPlan(graph: Graphlink<UT_StoreShape, any>, store: UT_StoreShape, catchItemBails: boolean, catchItemBails_asX: any, callArgs: any[], allowPersist: boolean) {
		const callPlan_new_index = allowPersist ? this.callPlansStored : -1;
		const callPlan_new = new AccessorCallPlan(this, graph, store, catchItemBails, catchItemBails_asX, callArgs, callPlan_new_index, ()=>{
			if (allowPersist) {
				this.callPlans.entry(cacheKey).delete();
			}
		});
		callPlan_new.callPlanMeta = this.callPlanMetas[callPlan_new.callPlanIndex] ?? new CallPlanMeta(callPlan_new);
		if (!allowPersist) return callPlan_new;

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
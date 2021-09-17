import {CE} from "js-vextensions";
import {IComputedValue, IComputedValueOptions, computed, onBecomeUnobserved, _isComputingDerivation, onBecomeObserved} from "mobx"
import {Graphlink} from "../index.js";
import {UT_StoreShape} from "../UserTypes.js";

//import {DeepMap} from "mobx-utils/lib/deepMap.js";
/*import deepMap_ from "mobx-utils/lib/deepMap.js";
const { DeepMap } = deepMap_; // wrapper for ts-node (eg. init-db scripts)*/
import {DeepMap} from "../Utils/General/DeepMap.js";
import {AccessorCallPlan} from "./@AccessorCallPlan.js";

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
   numberOfCallPlansStored = 0;
   GetCallPlan(graph: Graphlink<UT_StoreShape, any>, store: UT_StoreShape, catchItemBails: boolean, catchItemBails_asX: any, callArgs: any[], allowCacheGetOrSet: boolean) {
		const callPlan = new AccessorCallPlan(this, graph, store, catchItemBails, catchItemBails_asX, callArgs, this.numberOfCallPlansStored, ()=>{
			this.callPlans.entry(cacheKey).delete();
		});
		if (!allowCacheGetOrSet) return callPlan;

		const cacheKey = callPlan.GetCacheKey();
		const entry = this.callPlans.entry(cacheKey);
		if (!entry.exists()) {
			entry.set(callPlan);
			this.numberOfCallPlansStored++;
		}
		return entry.get();
	}
}

// helpers, for profiling and such
// ==========

export function LogAccessorMetadatas() {
	const accessorRunTimes_ordered = CE(CE(accessorMetadata).VValues()).OrderByDescending(a=>a.totalRunTime);
	//console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a=>a.totalRunTime_asRoot)).Sum()})`);
	console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()})`);
	//Log({}, accessorRunTimes_ordered);
	console.table(accessorRunTimes_ordered);
}

export function GetAccessorRunInfos() {
	type RunInfo = {name: string} & Pick<AccessorMetadata, "totalRunTime" | "callCount"> & {callPlansStored: number, rest: AccessorMetadata};
	//const result = {} as {[key: string]: RunInfo};
	const result = [] as RunInfo[];
	const entries = Array.from(accessorMetadata);
	for (const [key, value] of CE(entries).OrderByDescending(a=>a[1].totalRunTime)) {
		//result[key] = {callCount: value.callCount, totalRunTime: value.totalRunTime, rest: value};
		result.push({name: key, totalRunTime: value.totalRunTime, callCount: value.callCount, callPlansStored: value.numberOfCallPlansStored, rest: value});
	}
	return result;
}
export function LogAccessorRunInfos() {
	const runInfos = GetAccessorRunInfos();
	//console.log(`Accessor cumulative run-times: @TotalCalls(${CE(accessorRunTimes_ordered.map(a=>a.callCount)).Sum()}) @TotalTimeInRootAccessors(${CE(accessorRunTimes_ordered.map(a=>a.totalRunTime_asRoot)).Sum()})`);
	console.log(`Accessor cumulative info: @TotalCalls(${CE(runInfos.map(a=>a.callCount)).Sum()})`);
	//Log({}, accessorRunTimes_ordered);
	console.table(runInfos);
}
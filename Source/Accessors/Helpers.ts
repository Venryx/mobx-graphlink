import {Assert, E, StringCE, WaitXThenRun} from "js-vextensions";
import {reaction, when} from "mobx";
import {defaultGraphRefs} from "../Graphlink.js";
import {Graphlink, GraphRefs} from "../index.js";
import {DataStatus} from "../Tree/TreeNodeData.js";
import {TreeNodePlaceholder, TreeRequestWatcher} from "../Tree/TreeRequestWatcher.js";
import {n} from "../Utils/@Internal/Types.js";
import {BailError} from "../Utils/General/BailManager.js";
import {RunInAction} from "../Utils/General/MobX.js";

export enum BailHandling {
	ThrowImmediately,
	ThrowAtEnd_1st,
	CallCustomHandler,
}
export function MapWithBailHandling<T, T2>(array: T[], mapFunc: (item: T, index: number)=>T2, bailHandling = BailHandling.ThrowAtEnd_1st, customBailHandler: (bailError: BailError, index: number)=>any = ()=>{}): T2[] {
	const bailErrors = [] as BailError[];
	const results = array.map((item, index)=>{
		try {
			const result = mapFunc(item, index);
			return result;
		} catch (ex) {
			if (ex instanceof BailError) {
				bailErrors.push(ex);
				if (bailHandling == BailHandling.ThrowImmediately) {
					throw ex;
				} else if (bailHandling == BailHandling.ThrowAtEnd_1st) {
					return null; // doesn't matter what we return here; "throw" at end will interrupt the whole function
				} else if (bailHandling == BailHandling.CallCustomHandler) {
					return customBailHandler(ex, index);
				}
			}
			throw ex;
		}
	});
	if (bailHandling == BailHandling.ThrowAtEnd_1st && bailErrors.length) {
		throw bailErrors[0];
	}
	return results;
}

export class GetWait_Options {
	static default = new GetWait_Options();

	// fields from GraphRefs
	graph: Graphlink<any, any>;
}

/** Accessor wrapper which throws an error if one of the base db-requests is still loading. (to be used in Command.Validate functions) */
// (one of the rare cases where opt is not the first argument; that's because GetWait may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
// Note: This function doesn't really have a purpose atm, as Command.Validate functions already use a GetAsync wrapper that quick-throws as soon as any db-request has to wait.
export function GetWait<T>(dataGetterFunc: ()=>T, options?: Partial<GetWait_Options>, funcName?: string): T {
	// Alt approach 1) Use checks like "=== null", "=== undefined", and "=== emptyArray_forLoading" [con: hard to ensure these magic values are propogated through every level properly]
	// Alt approach 2) Find main tree-node, and just checks its single node.status value [con: doesn't work for freeform/multi-tree-node store-accessors]
	// Alt approach 3) For places where you'd need this func, just call "GetAsync(()=>...)" instead; it will keep re-calling the store-accessor until all accessors within it "fully resolve" [choice atm]

	const opt = E(GetWait_Options.default, defaultGraphRefs, options) as GraphRefs;
	const watcher = new TreeRequestWatcher(opt.graph);

	// prep for getter-func
	watcher.Start();
	// flip some flag here to say, "don't use cached data -- re-request!"
	//storeAccessorCachingTempDisabled = true;

	const result = dataGetterFunc();

	// cleanup for getter-func
	//storeAccessorCachingTempDisabled = false;
	watcher.Stop();

	const nodesRequested_array = Array.from(watcher.nodesRequested);
	const requestsBeingWaitedFor = nodesRequested_array.filter(node=>{
		if (node instanceof TreeNodePlaceholder) return true;
		// arguably, this may be able to use node.PreferredData; but to be safe, we use node.data_fromSelf
		return node.data_fromSelf.status != DataStatus.Received_Live; // only accept Received_Live as valid, in GetAsync
	});
	const done = requestsBeingWaitedFor.length == 0;
	if (!done) {
		throw new BailError(`Store-accessor "${funcName ?? "n/a"}" not yet resolved. (it still has ${requestsBeingWaitedFor.length} requests being waited for)`);
	}

	return result;
}

/** reject: caller of "await GetAsync()" receives the error, log: catch error and log it, ignore: catch error */
export type GetAsync_ErrorHandleType = "rejectAndLog" | "reject" | "log" | "ignore";

export class GetAsync_Options {
	static default = new GetAsync_Options();

	// fields from GraphRefs
	graph: Graphlink<any, any>;

	/** Just meant to alert us for infinite-loop-like calls/getter-funcs. Default: 100 [pretty arbitrary] */
	maxIterations? = 100; // todo: maybe replace this with system that tracks the list of paths accessed, and which halts if it "senses no progression" [eg. max-iterations-without-change-to-access-paths]
	/** How to handle errors that occur in accessor, when there are still db-requests in progress. (ie. when accessor is still progressing) */
	errorHandling_during? = "ignore" as GetAsync_ErrorHandleType;
	/** How to handle errors that occur in accessor, when no db-requests are still in progress. (ie. on final accessor call) */
	errorHandling_final? = "reject" as GetAsync_ErrorHandleType;

	// todo: maybe add these fields, to customize whether/what-type of cache-blocking to use
	//blockCallPlanEntryCacheUsage?: boolean; // blocks "finding" of any existing `CallPlan` entries, for the tree of accessor-invocations that occur within `dataGetterFunc` [active atm, and needed for GetAsync to know when it has "resolved"]
	//blockCallPlanResultCacheUsage?: boolean; // blocks usage of `AccessorCallPlan.cachedResult_wrapper` [not yet implemented; probably not necessary, though may be cleaner alternative to `blockCallPlanEntryCacheUsage`]
	//blockTreeNodeDataCacheUsage?: boolean; // if this caching is blocked alongside one/both of the cache-types above, fresh data will be requested from the db (well, assuming the apollo-client layer is not caching it anyway) [not yet implemented]
}

// async helper
// (one of the rare cases where opt is not the first argument; that's because GetAsync may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
export async function GetAsync<T>(dataGetterFunc: ()=>T, options?: Partial<GetAsync_Options>): Promise<T> {
	const opt = E(GetAsync_Options.default, defaultGraphRefs, options) as GetAsync_Options;
	const watcher = new TreeRequestWatcher(opt.graph);

	/*let lastResult;
	let nodesRequested_obj_last;
	let nodesRequested_obj;
	do {
		nodesRequested_obj_last = nodesRequested_obj;

		watcher.Start();
		//let dispose = autorun(()=> {
		lastResult = dataGetterFunc();
		//});
		//dispose();
		watcher.Stop();

		const nodesRequested_array = Array.from(watcher.nodesRequested);
		nodesRequested_obj = CE(nodesRequested_array).ToMap(a=>a.path, a=>true);

		// wait till all requested nodes have their data received
		await Promise.all(nodesRequested_array.map(node=> {
			return when(()=>node.status == DataStatus.Received);
		}));
	} while (ShallowChanged(nodesRequested_obj, nodesRequested_obj_last));
	
	return lastResult;*/

	return new Promise((resolve, reject)=>{
		let iterationIndex = -1;
		const dispose = reaction(()=>{
			iterationIndex++;

			// prep for getter-func
			watcher.Start();
			// flip some flag here to say, "don't use cached data -- re-request!"
			opt.graph.storeAccessorCachingTempDisabled = true;
			let result;

			let accessor_lastError;
			function HandleAccessorError(ex: Error, handling: GetAsync_ErrorHandleType) {
				//console.log("Handling accessor error:", ex, "@handling:", handling);
				/*if (ex instanceof BailError) {
					return; // always ignore bail-messages in GetAsync (is this the ideal behavior?)
				}*/

				accessor_lastError = ex;

				// if last iteration, never catch -- we want to see the error, as it's likely the cause of the seemingly-infinite iteration
				if (handling == "reject" || handling == "rejectAndLog") {
					//console.log("Calling reject, from error:", ex);
					reject(ex); // call reject, so that caller of GetAsync() can receives/can-catch the error (rather than the global mobx "reaction()" catching it)

					//throw ex; // also rethrow it, so reaction stops, and we see error message in server log // commented; caller of GetAsync() may want to catch it
					if (handling == "rejectAndLog") console.error(ex); // also log error
					// also end/dispose reaction (unless first iteration; attempting it then causes an error, and would be unnecesary anyway)
					if (iterationIndex > 0) dispose();
				} else if (handling == "log") {
					console.error(ex);
				}
			}

			// execute getter-func
			try {
				result = dataGetterFunc();
			} catch (ex) {
				HandleAccessorError(ex, opt.errorHandling_during!);
			}

			// cleanup for getter-func
			opt.graph.storeAccessorCachingTempDisabled = false;
			watcher.Stop();

			const nodesRequested_array = Array.from(watcher.nodesRequested);
			const requestsBeingWaitedFor = nodesRequested_array.filter(node=>{
				if (node instanceof TreeNodePlaceholder) return true;
				// arguably, this may be able to use node.PreferredData; but to be safe, we use node.data_fromSelf
				return node.data_fromSelf.status != DataStatus.Received_Live; // only accept Received_Live as valid, in GetAsync
			});
			const dbRequestsAllResolved = requestsBeingWaitedFor.length == 0 && !(accessor_lastError instanceof BailError);
			const maxIterationsReached = iterationIndex >= opt.maxIterations! - 1;

			const finalCall = dbRequestsAllResolved || maxIterationsReached;
			// if this is our last iteration, and an error is still being hit in accessor, apply the "errorHandling_final" option (generally triggers error without catching, so error bubbles out of this function)
			if (finalCall && accessor_lastError != null) {
				//Assert(error == null, `Error occurred during final GetAsync iteration: ${error}`);
				AssertV_triggerDebugger = true;
				try {
					//result = dataGetterFunc();
					//dataGetterFunc();
					dataGetterFunc();
				} catch (ex) {
					HandleAccessorError(ex, opt.errorHandling_final!);
				} finally {
					AssertV_triggerDebugger = false;
				}
			}

			if (maxIterationsReached && !dbRequestsAllResolved) {
				//console.log("Calling reject, from hitting max-iterations...");
				reject(StringCE(`
					GetAsync reached the maxIterations (${opt.maxIterations}) without completely resolving. Call was cancelled/rejected.
					
					Setting "window.logTypes.subscriptions = true" in console may help with debugging.
				`).AsMultiline(0));
			}

			//console.log("Loop contents:", {result, nodesRequested_array, fullyResolved: dbRequestsAllResolved});
			return {result, nodesRequested_array, fullyResolved: dbRequestsAllResolved};
		}, data=>{
			// if data is null, it means an error occured in the computation-func above
			if (data == null) return;

			const {result, nodesRequested_array, fullyResolved} = data;
			if (!fullyResolved) return;

			//Assert(result != null, "GetAsync should not usually return null.");
			WaitXThenRun(0, ()=>dispose()); // wait a bit, so dispose-func is ready (for when fired immediately)
			//console.log("Resolve called:", {result, nodesRequested_array, fullyResolved, data});
			resolve(result);
		}, {fireImmediately: true});
	});
}

// todo: probably merge this with GetAsync (or perhaps extract their combined behavior into a shared base func), after having more experience with it
export type EffectFunc = ()=>any;
export type AddEffect = (effectFunc: EffectFunc)=>void;
/** Similar to GetAsync, except includes helper for delaying effect-execution (ie. mobx changes) till end, and without certain data-centric behaviors (like disabling db-cache during resolution). */
export async function WaitTillResolvedThenExecuteSideEffects({
	resolveCondition = "no bail-error" as "returns true" | "no bail-error" | "no error",
	effectExecution = "action" as "plain" | "action",
	// Why a default timeout? Because if user tries to perform an action, but db-wait causes pause, we don't want it executing an hour later when they aren't expecting it.
	timeout = 5000 as number|n,
	onTimeout = "reject promise" as "resolve promise" | "reject promise" | "do nothing",
	timeoutMessage = "WaitTillResolvedThenExecuteSideEffects call timed out.",
}, func: (addEffect: AddEffect)=>any) {
	return new Promise<{result: any, error: any, errorHit: boolean}>((resolve, reject)=>{
		const effectFuncs = [] as EffectFunc[];
		const addEffect = (effectFunc: EffectFunc)=>{
			effectFuncs.push(effectFunc);
		};
		let result, error, errorHit = false;

		let done = false;
		const disposeEarly = when(()=>{
			// reset variables
			effectFuncs.length = 0;
			result = undefined;
			error = undefined;
			errorHit = false;

			try {
				result = func(addEffect);
			} catch (ex) {
				error = ex;
				errorHit = true;
			}

			if (resolveCondition == "returns true") return result === true;
			if (resolveCondition == "no bail-error") return !(error instanceof BailError);
			if (resolveCondition == "no error") return !errorHit;
			return false;
		}, ()=>{
			if (effectFuncs.length == 0) return;

			if (effectExecution == "plain") {
				effectFuncs.forEach(a=>a());
			} else if (effectExecution == "action") {
				RunInAction("WaitTillResolvedThenExecuteSideEffects_effectExecution", ()=>{
					effectFuncs.forEach(a=>a());
				});
			}

			done = true;
			resolve({result, error, errorHit});
		});

		if (timeout != null) {
			setTimeout(()=>{
				if (!done) {
					disposeEarly();
					if (onTimeout == "resolve promise") {
						resolve({result, error, errorHit});
					} else if (onTimeout == "reject promise") {
						reject(timeoutMessage);
					} else if (onTimeout == "do nothing") {
						// do nothing ;)
					}
				}
			}, timeout);
		}
	});
}

export let AssertV_triggerDebugger = false;
/** Variant of Assert, which does not trigger the debugger. (to be used in mobx-graphlink Command.Validate functions, since it's okay/expected for those to fail asserts) */
export function AssertV(condition, messageOrMessageFunc?: string | Function | null): asserts condition {
	Assert(condition, messageOrMessageFunc as any /* temp */, AssertV_triggerDebugger);
	return true as any;
}

/*export function AV(propNameOrGetter: string | ((..._)=>any)) {
	return new AVWrapper(propNameOrGetter);
} /*as ((propNameOrGetter: string | ((..._)=>any))=>AVWrapper) & {
	NonNull_<T>(value: T): T,
	NonNull: any,
};*#/
// this doesn't work; type isn't known to left of our entry
/*export function AV<T>(propNameOrGetter: string | ((..._)=>T)) {
	return new AVWrapper<T>(propNameOrGetter);
}*#/
Object.defineProperty(AV, "NonNull_", {value: (value)=>AVWrapper.generic.NonNull_(value)});
Object.defineProperty(AV, "NonNull", {set: (value)=>AVWrapper.generic.NonNull = value});*/

declare global {
	interface Function {
		/** Helper object for making in-line assertions. */
		get AV(): AVWrapper;
	}
}
Object.defineProperty(Function.prototype, "AV", {
	value(this: Function) {
		//this.propName = propNameOrGetter instanceof Function ? MobXPathGetterToPath(propNameOrGetter) : propNameOrGetter;
		return new AVWrapper(this as ((..._)=>any));
	},
});

/** Helper class for making in-line assertions. */
class AVWrapper {
	static generic = new AVWrapper("");

	constructor(propNameOrGetter: string | ((..._)=>any)) {
		//this.propName = propNameOrGetter instanceof Function ? MobXPathGetterToPath(propNameOrGetter) : propNameOrGetter;
		this.propName = propNameOrGetter instanceof Function ? propNameOrGetter.toString().match(/=>.+?([a-zA-Z_]+)/)![1] : propNameOrGetter;
	}

	private propName: string;

	NonNull_<T>(value: T) {
		AssertV(value != null, ()=>`Value${this.propName ? ` of prop "${this.propName}"` : ""} cannot be null. (provided value: ${value})`);
		return value;
	}
	set NonNull(value: NonNullable<any>) {
		this.NonNull_(value);
	}
}
/** Helper object for making in-line assertions. */
export const AV = AVWrapper.generic;

export function NNV<T>(val: T): NonNullable<T> {
	AssertV(val != null, ()=>`Value cannot be null. (provided value: ${val})`);
	return val as any;
}
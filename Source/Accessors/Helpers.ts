import {Assert, E, StringCE, WaitXThenRun} from "js-vextensions";
import {reaction} from "mobx";
import {defaultGraphOptions, GraphOptions} from "../Graphlink.js";
import {DataStatus, TreeNode} from "../Tree/TreeNode.js";
import {TreeRequestWatcher} from "../Tree/TreeRequestWatcher.js";
import {MobXPathGetterToPath} from "../Utils/DB/DBPaths.js";

/** Accessor wrapper which throws an error if one of the base db-requests is still loading. (to be used in Command.Validate functions) */
// (one of the rare cases where opt is not the first argument; that's because GetWait may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
// Note: This function doesn't really have a purpose atm, as Command.Validate functions already use a GetAsync wrapper that quick-throws as soon as any db-request has to wait.
export function GetWait<T>(dataGetterFunc: ()=>T, options?: Partial<GraphOptions>, funcName?: string): T {
	// Alt approach 1) Use checks like "=== null", "=== undefined", and "=== emptyArray_forLoading" [con: hard to ensure these magic values are propogated through every level properly]
	// Alt approach 2) Find main tree-node, and just checks its single node.status value [con: doesn't work for freeform/multi-tree-node store-accessors]
	// Alt approach 3) For places where you'd need this func, just call "GetAsync(()=>...)" instead; it will keep re-calling the store-accessor until all accessors within it "fully resolve" [choice atm]

	const opt = E(defaultGraphOptions, options) as GraphOptions;
	let watcher = new TreeRequestWatcher(opt.graph);

	// prep for getter-func
	watcher.Start();
	// flip some flag here to say, "don't use cached data -- re-request!"
	//storeAccessorCachingTempDisabled = true;

	let result = dataGetterFunc();
	
	// cleanup for getter-func
	//storeAccessorCachingTempDisabled = false;
	watcher.Stop();
	
	let nodesRequested_array = Array.from(watcher.nodesRequested);
	//let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status == DataStatus.Waiting);
	//let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status != DataStatus.Received);
	let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status != DataStatus.Received_Full);
	let done = requestsBeingWaitedFor.length == 0;
	if (!done) {
		throw new Error(`Store-accessor "${funcName ?? "n/a"}" not yet resolved. (it still has ${requestsBeingWaitedFor.length} requests being waited for)`)	
	}

	return result;
}

export class GetAsync_Options {
	static default = new GetAsync_Options();
	/** Just meant to alert us for infinite-loop-like calls/getter-funcs. Default: 50 [pretty arbitrary] */
	maxIterations? = 50; // todo: maybe replace this with system that tracks the list of paths accessed, and which halts if it "senses no progression" [eg. max-iterations-without-change-to-access-paths]
	errorHandling? = "none" as "none" | "log" | "ignore";
	/** If true, db requests within dataGetterFunc that find themselves waiting for remote db-data, with throw an error immediately. (avoiding higher-level processing) */
	throwImmediatelyOnDBWait? = false;
}
export let GetAsync_throwImmediatelyOnDBWait_activeDepth = 0;
export function NotifyWaitingForDB(dbPath: string) {
	if (GetAsync_throwImmediatelyOnDBWait_activeDepth > 0) {
		throw new Error(`DB tree-node for "${dbPath}" is waiting for database data that isn't ready yet. Throwing error now (to avoid higher-level processing) until data is ready.`);
	}
}

// async helper
// (one of the rare cases where opt is not the first argument; that's because GetAsync may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
export async function GetAsync<T>(dataGetterFunc: ()=>T, options?: Partial<GraphOptions> & GetAsync_Options): Promise<T> {
	const opt = E(defaultGraphOptions, GetAsync_Options.default, options) as GraphOptions & GetAsync_Options;
	let watcher = new TreeRequestWatcher(opt.graph);

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

	return new Promise((resolve, reject)=> {
		let iterationIndex = -1;
		let dispose = reaction(()=> {
			iterationIndex++;
			
			// prep for getter-func
			watcher.Start();
			if (options?.throwImmediatelyOnDBWait) GetAsync_throwImmediatelyOnDBWait_activeDepth++;
			// flip some flag here to say, "don't use cached data -- re-request!"
			storeAccessorCachingTempDisabled = true;
			let result;

			// execute getter-func
			let error;
			// if last iteration, never catch -- we want to see the error, as it's likely the cause of the seemingly-infinite iteration
			if (opt.errorHandling == "none" || iterationIndex >= opt.maxIterations! - 1) {
				result = dataGetterFunc();
			} else {
				try {
					result = dataGetterFunc();
				} catch (ex) {
					error = ex;
					if (opt.errorHandling == "log") {
						console.error(ex);
					}
				}
			}
			
			// cleanup for getter-func
			storeAccessorCachingTempDisabled = false;
			if (options?.throwImmediatelyOnDBWait) GetAsync_throwImmediatelyOnDBWait_activeDepth--;
			watcher.Stop();
			
			let nodesRequested_array = Array.from(watcher.nodesRequested);
			//let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status == DataStatus.Waiting);
			//let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status != DataStatus.Received);
			let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status != DataStatus.Received_Full);
			let done = requestsBeingWaitedFor.length == 0;
			if (done && error != null) {
				//Assert(error == null, `Error occurred during final GetAsync iteration: ${error}`);
				AssertV_triggerDebugger = true;
				try {
					//result = dataGetterFunc();
					dataGetterFunc();
				} finally {
					AssertV_triggerDebugger = false;
				}
			}

			if (iterationIndex + 1 > opt.maxIterations!) {
				reject(StringCE(`
					GetAsync exceeded the maxIterations (${opt.maxIterations}).
					
					Setting "window.logTypes.subscriptions = true" in console may help with debugging.
				`).AsMultiline(0));
			}

			return {result, nodesRequested_array, done};
		}, data=> {
			 // if data is null, it means an error occured in the computation-func above
			if (data == null) return;

			let {result, nodesRequested_array, done} = data;
			if (!done) return;

			//Assert(result != null, "GetAsync should not usually return null.");
			WaitXThenRun(0, ()=>dispose()); // wait a bit, so dispose-func is ready (for when fired immediately)
			resolve(result);
		}, {fireImmediately: true});
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
	value: function(this: Function) {
		//this.propName = propNameOrGetter instanceof Function ? MobXPathGetterToPath(propNameOrGetter) : propNameOrGetter;
		return new AVWrapper(this as ((..._)=>any));
	},
})

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

export let storeAccessorCachingTempDisabled = false;
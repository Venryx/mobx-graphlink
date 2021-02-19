import {Assert, E, StringCE, WaitXThenRun} from "js-vextensions";
import {reaction} from "mobx";
import {defaultFireOptions, FireOptions} from "../Graphlink";
import {DataStatus} from "../Tree/TreeNode";
import {TreeRequestWatcher} from "../Tree/TreeRequestWatcher";

/** Accessor wrapper which throws an error if one of the base db-requests is still loading. (to be used in Command.Validate functions) */
// (one of the rare cases where opt is not the first argument; that's because GetWait may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
export function GetWait<T>(dataGetterFunc: ()=>T, options?: Partial<FireOptions>): T {
	const opt = E(defaultFireOptions, options) as FireOptions;
	let watcher = new TreeRequestWatcher(opt.fire);

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
		throw new Error("Store-accessor not yet resolved. (ie. one of its db-requests is still loading)")	
	}

	return result;
}

export class GetAsync_Options {
	static default = new GetAsync_Options();
	maxIterations? = 50; // pretty arbitrary; just meant to alert us for infinite-loop-like calls/getter-funcs
	errorHandling? = "none" as "none" | "log" | "ignore";
}

// async helper
// (one of the rare cases where opt is not the first argument; that's because GetAsync may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
export async function GetAsync<T>(dataGetterFunc: ()=>T, options?: Partial<FireOptions> & GetAsync_Options): Promise<T> {
	const opt = E(defaultFireOptions, GetAsync_Options.default, options) as FireOptions & GetAsync_Options;
	let watcher = new TreeRequestWatcher(opt.fire);

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
export function AssertV(condition, messageOrMessageFunc?: string | Function): condition is true {
	Assert(condition, messageOrMessageFunc, AssertV_triggerDebugger);
	return true;
}

export const AV = ((propName: string)=> {
	return new AVWrapper(propName);
}) as ((propName: string)=>AVWrapper) & {
	NonNull_<T>(value: T): T,
	NonNull: any,
};
Object.defineProperty(AV, "NonNull_", {value: (value)=>AVWrapper.generic.NonNull_(value)});
Object.defineProperty(AV, "NonNull", {set: (value)=>AVWrapper.generic.NonNull = value});

class AVWrapper {
	static generic = new AVWrapper("");

	constructor(public propName: string) {}
	NonNull_<T>(value: T) {
		AssertV(value != null, ()=>`Value${this.propName ? ` of prop "${this.propName}"` : ""} cannot be null. (provided value: ${value})`);
		return value;
	}
	set NonNull(value) {
		this.NonNull_(value);
	}
}

export let storeAccessorCachingTempDisabled = false;
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Assert, E, StringCE, WaitXThenRun } from "js-vextensions";
import { reaction } from "mobx";
import { defaultGraphOptions } from "../Graphlink.js";
import { DataStatus } from "../Tree/TreeNode.js";
import { TreeRequestWatcher } from "../Tree/TreeRequestWatcher.js";
/** Accessor wrapper which throws an error if one of the base db-requests is still loading. (to be used in Command.Validate functions) */
// (one of the rare cases where opt is not the first argument; that's because GetWait may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
export function GetWait(dataGetterFunc, options, funcName) {
    // Alt approach 1) Use checks like "=== null", "=== undefined", and "=== emptyArray_forLoading" [con: hard to ensure these magic values are propogated through every level properly]
    // Alt approach 2) Find main tree-node, and just checks its single node.status value [con: doesn't work for freeform/multi-tree-node store-accessors]
    // Alt approach 3) For places where you'd need this func, just call "GetAsync(()=>...)" instead; it will keep re-calling the store-accessor until all accessors within it "fully resolve" [choice atm]
    const opt = E(defaultGraphOptions, options);
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
    let requestsBeingWaitedFor = nodesRequested_array.filter(node => node.status != DataStatus.Received_Full);
    let done = requestsBeingWaitedFor.length == 0;
    if (!done) {
        throw new Error(`Store-accessor "${funcName !== null && funcName !== void 0 ? funcName : "n/a"}" not yet resolved. (it still has ${requestsBeingWaitedFor.length} requests being waited for)`);
    }
    return result;
}
export class GetAsync_Options {
    constructor() {
        /** Just meant to alert us for infinite-loop-like calls/getter-funcs. Default: 50 [pretty arbitrary] */
        this.maxIterations = 50; // todo: maybe replace this with system that tracks the list of paths accessed, and which halts if it "senses no progression" [eg. max-iterations-without-change-to-access-paths]
        this.errorHandling = "none";
        /** If true, db requests within dataGetterFunc that find themselves waiting for remote db-data, with throw an error immediately. (avoiding higher-level processing) */
        this.throwImmediatelyOnDBWait = true;
    }
}
GetAsync_Options.default = new GetAsync_Options();
export let GetAsync_throwImmediatelyOnDBWait_activeDepth = 0;
export function NotifyWaitingForDB(dbPath) {
    if (GetAsync_throwImmediatelyOnDBWait_activeDepth > 0) {
        throw new Error(`DB tree-node for "${dbPath}" is waiting for database data that isn't ready yet. Throwing error now (to avoid higher-level processing) until data is ready.`);
    }
}
// async helper
// (one of the rare cases where opt is not the first argument; that's because GetAsync may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
export function GetAsync(dataGetterFunc, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const opt = E(defaultGraphOptions, GetAsync_Options.default, options);
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
        return new Promise((resolve, reject) => {
            let iterationIndex = -1;
            let dispose = reaction(() => {
                iterationIndex++;
                // prep for getter-func
                watcher.Start();
                GetAsync_throwImmediatelyOnDBWait_activeDepth++;
                // flip some flag here to say, "don't use cached data -- re-request!"
                storeAccessorCachingTempDisabled = true;
                let result;
                // execute getter-func
                let error;
                // if last iteration, never catch -- we want to see the error, as it's likely the cause of the seemingly-infinite iteration
                if (opt.errorHandling == "none" || iterationIndex >= opt.maxIterations - 1) {
                    result = dataGetterFunc();
                }
                else {
                    try {
                        result = dataGetterFunc();
                    }
                    catch (ex) {
                        error = ex;
                        if (opt.errorHandling == "log") {
                            console.error(ex);
                        }
                    }
                }
                // cleanup for getter-func
                storeAccessorCachingTempDisabled = false;
                GetAsync_throwImmediatelyOnDBWait_activeDepth--;
                watcher.Stop();
                let nodesRequested_array = Array.from(watcher.nodesRequested);
                //let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status == DataStatus.Waiting);
                //let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status != DataStatus.Received);
                let requestsBeingWaitedFor = nodesRequested_array.filter(node => node.status != DataStatus.Received_Full);
                let done = requestsBeingWaitedFor.length == 0;
                if (done && error != null) {
                    //Assert(error == null, `Error occurred during final GetAsync iteration: ${error}`);
                    AssertV_triggerDebugger = true;
                    try {
                        //result = dataGetterFunc();
                        dataGetterFunc();
                    }
                    finally {
                        AssertV_triggerDebugger = false;
                    }
                }
                if (iterationIndex + 1 > opt.maxIterations) {
                    reject(StringCE(`
					GetAsync exceeded the maxIterations (${opt.maxIterations}).
					
					Setting "window.logTypes.subscriptions = true" in console may help with debugging.
				`).AsMultiline(0));
                }
                return { result, nodesRequested_array, done };
            }, data => {
                // if data is null, it means an error occured in the computation-func above
                if (data == null)
                    return;
                let { result, nodesRequested_array, done } = data;
                if (!done)
                    return;
                //Assert(result != null, "GetAsync should not usually return null.");
                WaitXThenRun(0, () => dispose()); // wait a bit, so dispose-func is ready (for when fired immediately)
                resolve(result);
            }, { fireImmediately: true });
        });
    });
}
export let AssertV_triggerDebugger = false;
/** Variant of Assert, which does not trigger the debugger. (to be used in mobx-graphlink Command.Validate functions, since it's okay/expected for those to fail asserts) */
export function AssertV(condition, messageOrMessageFunc) {
    Assert(condition, messageOrMessageFunc, AssertV_triggerDebugger);
    return true;
}
Object.defineProperty(Function.prototype, "AV", {
    value: function () {
        //this.propName = propNameOrGetter instanceof Function ? MobXPathGetterToPath(propNameOrGetter) : propNameOrGetter;
        return new AVWrapper(this);
    },
});
/** Helper class for making in-line assertions. */
class AVWrapper {
    constructor(propNameOrGetter) {
        //this.propName = propNameOrGetter instanceof Function ? MobXPathGetterToPath(propNameOrGetter) : propNameOrGetter;
        this.propName = propNameOrGetter instanceof Function ? propNameOrGetter.toString().match(/=>.+?([a-zA-Z_]+)/)[1] : propNameOrGetter;
    }
    NonNull_(value) {
        AssertV(value != null, () => `Value${this.propName ? ` of prop "${this.propName}"` : ""} cannot be null. (provided value: ${value})`);
        return value;
    }
    set NonNull(value) {
        this.NonNull_(value);
    }
}
AVWrapper.generic = new AVWrapper("");
/** Helper object for making in-line assertions. */
export const AV = AVWrapper.generic;
export let storeAccessorCachingTempDisabled = false;

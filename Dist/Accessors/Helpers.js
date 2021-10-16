import { Assert, E, StringCE, WaitXThenRun } from "js-vextensions";
import { reaction, when } from "mobx";
import { defaultGraphOptions } from "../Graphlink.js";
import { DataStatus } from "../Tree/TreeNode.js";
import { TreeRequestWatcher } from "../Tree/TreeRequestWatcher.js";
import { BailError } from "../Utils/General/BailManager.js";
import { RunInAction } from "../Utils/General/MobX.js";
/** Accessor wrapper which throws an error if one of the base db-requests is still loading. (to be used in Command.Validate functions) */
// (one of the rare cases where opt is not the first argument; that's because GetWait may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
// Note: This function doesn't really have a purpose atm, as Command.Validate functions already use a GetAsync wrapper that quick-throws as soon as any db-request has to wait.
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
        /** Just meant to alert us for infinite-loop-like calls/getter-funcs. Default: 100 [pretty arbitrary] */
        Object.defineProperty(this, "maxIterations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 100
        }); // todo: maybe replace this with system that tracks the list of paths accessed, and which halts if it "senses no progression" [eg. max-iterations-without-change-to-access-paths]
        /** How to handle errors that occur in accessor, when there are still db-requests in progress. (ie. when accessor is still progressing) */
        Object.defineProperty(this, "errorHandling_during", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "ignore"
        });
        /** How to handle errors that occur in accessor, when no db-requests are still in progress. (ie. on final accessor call) */
        Object.defineProperty(this, "errorHandling_final", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "reject"
        });
        /** If true, db requests within dataGetterFunc that find themselves waiting for remote db-data, with throw an error immediately. (avoiding higher-level processing) */
        Object.defineProperty(this, "throwImmediatelyOnDBWait", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
}
Object.defineProperty(GetAsync_Options, "default", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new GetAsync_Options()
});
export let GetAsync_throwImmediatelyOnDBWait_activeDepth = 0;
export function NotifyWaitingForDB(dbPath) {
    if (GetAsync_throwImmediatelyOnDBWait_activeDepth > 0) {
        throw new Error(`DB tree-node for "${dbPath}" is waiting for database data that isn't ready yet. Throwing error now (to avoid higher-level processing) until data is ready.`);
    }
}
// async helper
// (one of the rare cases where opt is not the first argument; that's because GetAsync may be called very frequently/in-sequences, and usually wraps nice user accessors, so could add too much visual clutter)
export async function GetAsync(dataGetterFunc, options) {
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
            if (options === null || options === void 0 ? void 0 : options.throwImmediatelyOnDBWait)
                GetAsync_throwImmediatelyOnDBWait_activeDepth++;
            // flip some flag here to say, "don't use cached data -- re-request!"
            opt.graph.storeAccessorCachingTempDisabled = true;
            let result;
            let accessor_lastError;
            function HandleAccessorError(ex, handling) {
                if (ex instanceof BailError) {
                    return; // always ignore bail-messages in GetAsync (is this the ideal behavior?)
                }
                accessor_lastError = ex;
                // if last iteration, never catch -- we want to see the error, as it's likely the cause of the seemingly-infinite iteration
                if (handling == "reject" || handling == "rejectAndLog") {
                    reject(ex); // call reject, so that caller of GetAsync() can receives/can-catch the error (rather than the global mobx "reaction()" catching it)
                    //throw ex; // also rethrow it, so reaction stops, and we see error message in server log // commented; caller of GetAsync() may want to catch it
                    if (handling == "rejectAndLog")
                        console.error(ex); // also log error
                    // also end/dispose reaction (unless first iteration; attempting it then causes an error, and would be unnecesary anyway)
                    if (iterationIndex > 0)
                        dispose();
                }
                else if (handling == "log") {
                    console.error(ex);
                }
            }
            // execute getter-func
            try {
                result = dataGetterFunc();
            }
            catch (ex) {
                HandleAccessorError(ex, opt.errorHandling_during);
            }
            // cleanup for getter-func
            opt.graph.storeAccessorCachingTempDisabled = false;
            if (options === null || options === void 0 ? void 0 : options.throwImmediatelyOnDBWait)
                GetAsync_throwImmediatelyOnDBWait_activeDepth--;
            watcher.Stop();
            let nodesRequested_array = Array.from(watcher.nodesRequested);
            //let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status == DataStatus.Waiting);
            //let requestsBeingWaitedFor = nodesRequested_array.filter(node=>node.status != DataStatus.Received);
            let requestsBeingWaitedFor = nodesRequested_array.filter(node => node.status != DataStatus.Received_Full);
            const dbRequestsAllResolved = requestsBeingWaitedFor.length == 0;
            const maxIterationsReached = iterationIndex >= opt.maxIterations - 1;
            let finalCall = dbRequestsAllResolved || maxIterationsReached;
            if (finalCall && accessor_lastError != null) {
                //Assert(error == null, `Error occurred during final GetAsync iteration: ${error}`);
                AssertV_triggerDebugger = true;
                try {
                    //result = dataGetterFunc();
                    //dataGetterFunc();
                    dataGetterFunc();
                }
                catch (ex) {
                    HandleAccessorError(ex, opt.errorHandling_final);
                }
                finally {
                    AssertV_triggerDebugger = false;
                }
            }
            if (maxIterationsReached && !dbRequestsAllResolved) {
                reject(StringCE(`
					GetAsync reached the maxIterations (${opt.maxIterations}) without completely resolving. Call was cancelled/rejected.
					
					Setting "window.logTypes.subscriptions = true" in console may help with debugging.
				`).AsMultiline(0));
            }
            return { result, nodesRequested_array, fullyResolved: dbRequestsAllResolved };
        }, data => {
            // if data is null, it means an error occured in the computation-func above
            if (data == null)
                return;
            let { result, nodesRequested_array, fullyResolved } = data;
            if (!fullyResolved)
                return;
            //Assert(result != null, "GetAsync should not usually return null.");
            WaitXThenRun(0, () => dispose()); // wait a bit, so dispose-func is ready (for when fired immediately)
            resolve(result);
        }, { fireImmediately: true });
    });
}
/** Similar to GetAsync, except includes helper for delaying effect-execution (ie. mobx changes) till end, and without certain data-centric behaviors (like disabling db-cache during resolution). */
export async function WaitTillResolvedThenExecuteSideEffects({ resolveCondition = "no bail-error", effectExecution = "action", 
// Why a default timeout? Because if user tries to perform an action, but db-wait causes pause, we don't want it executing an hour later when they aren't expecting it.
timeout = 5000, onTimeout = "reject promise", timeoutMessage = "WaitTillResolvedThenExecuteSideEffects call timed out.", }, func) {
    return new Promise((resolve, reject) => {
        const effectFuncs = [];
        const addEffect = (effectFunc) => {
            effectFuncs.push(effectFunc);
        };
        let result, error, errorHit = false;
        let done = false;
        const disposeEarly = when(() => {
            // reset variables
            effectFuncs.length = 0;
            result = undefined;
            error = undefined;
            errorHit = false;
            try {
                result = func(addEffect);
            }
            catch (ex) {
                error = ex;
                errorHit = true;
            }
            if (resolveCondition == "returns true")
                return result === true;
            if (resolveCondition == "no bail-error")
                return !(error instanceof BailError);
            if (resolveCondition == "no error")
                return !errorHit;
            return false;
        }, () => {
            if (effectFuncs.length == 0)
                return;
            if (effectExecution == "plain") {
                effectFuncs.forEach(a => a());
            }
            else if (effectExecution == "action") {
                RunInAction("WaitTillResolvedThenExecuteSideEffects_effectExecution", () => {
                    effectFuncs.forEach(a => a());
                });
            }
            done = true;
            resolve({ result, error, errorHit });
        });
        if (timeout != null) {
            setTimeout(() => {
                if (!done) {
                    disposeEarly();
                    if (onTimeout == "resolve promise") {
                        resolve({ result, error, errorHit });
                    }
                    else if (onTimeout == "reject promise") {
                        reject(timeoutMessage);
                    }
                    else if (onTimeout == "do nothing") {
                        // do nothing ;)
                    }
                }
            }, timeout);
        }
    });
}
export let AssertV_triggerDebugger = false;
/** Variant of Assert, which does not trigger the debugger. (to be used in mobx-graphlink Command.Validate functions, since it's okay/expected for those to fail asserts) */
export function AssertV(condition, messageOrMessageFunc) {
    Assert(condition, messageOrMessageFunc /* temp */, AssertV_triggerDebugger);
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
        Object.defineProperty(this, "propName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
Object.defineProperty(AVWrapper, "generic", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new AVWrapper("")
});
/** Helper object for making in-line assertions. */
export const AV = AVWrapper.generic;
export function NNV(val) {
    AssertV(val != null, () => `Value cannot be null. (provided value: ${val})`);
    return val;
}

import { runInAction, _getGlobalState, makeObservable } from "mobx";
import { WaitXThenRun } from "js-vextensions";
export let _reactModule;
export function ProvideReactModule(reactModule) {
    _reactModule = reactModule;
}
export function makeObservable_safe(target, annotations, options) {
    if (annotations) {
        // for each annotated property, make sure the property exists (by setting it to undefined), else mobx will error
        for (const key of Object.keys(annotations)) {
            if (!(key in target)) {
                target[key] = undefined;
            }
        }
    }
    return makeObservable(target, annotations, options);
}
export function MobX_GetGlobalState() {
    return _getGlobalState();
}
export function RunInAction(name, action, afterActionFunc) {
    Object.defineProperty(action, "name", { value: name });
    let result;
    let actionErrored = true;
    try {
        result = runInAction(action);
        actionErrored = false;
    }
    finally {
        afterActionFunc === null || afterActionFunc === void 0 ? void 0 : afterActionFunc(actionErrored);
    }
    return result;
}
export function MobX_AllowStateChanges() {
    return MobX_GetGlobalState().allowStateChanges;
}
/*/**
 * Directly runs the passed-func, if in a computation-safe context (ie. if in a `runAction(...)` block); else, runs it in one, using `RunInAction(...)`.
 * *#/
 export function RunInAction_IfNeeded<T>(actionName: string, funcThatChangesObservables: ()=>T): T {
    if (MobX_AllowStateChanges()) {
        return funcThatChangesObservables();
    } else {
        return RunInAction(actionName, funcThatChangesObservables);
    }
}*/
/**
 * Directly runs the passed-func, if in a computation-safe context (ie. if in a `runAction(...)` block); else, schedules it for running in one, using `RunInNextTick_BundledInOneAction(...)`.
 * Returns true if was able to run immediately; else, returns false.
 * */
// old: * Supply the react module (using "ProvideReactModule(React)"") for this function to also protect from mobx-observable changes when a component is rendering.
export function RunInAction_WhenAble(actionName, funcThatChangesObservables, afterActionFunc) {
    //const inMobXComputation = MobX_GetGlobalState().computationDepth > 0;
    /*const inMobXComputation = !MobX_GetGlobalState().allowStateChanges;
    const inReactRender = _reactModule?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner.current != null;*/
    // if we're not in a mobx computation or react-render call, just run the func immediately
    // (Can't change mobx observables within mobx computation, else mobx errors.)
    // (Can't change mobx observables within react-render, else change may trigger mobx to trigger a new react-render, which react dislikes and gives warning for.)
    //if (!inMobXComputation && !inReactRender) {
    if (MobX_AllowStateChanges()) {
        RunInAction(actionName, funcThatChangesObservables, afterActionFunc);
        return true;
    }
    else { // eslint-disable-line
        // else, wait till we're out of computation/render call-stack, *then* run it
        //WaitXThenRun(0, funcThatChangesObservables);
        // (use bundled version of setImmediate; this is important, because it allows multiple TreeNode.Request() calls to activate in the same tick -- preventing ancestor accessors from triggering for every tree-node's attachment)
        //RunInNextTick_BundledInOneAction(funcThatChangesObservables);
        RunInNextTick_BundledInOneAction(() => {
            // Calling RunInAction here seems redundant, but:
            // 1) It provides more info in mobx-devtools. 
            // 2) It possibly affects the program flow a bit. (an issue, re. GetAsync() not reliably returning a db-entry, seemed to get a bit worse when this was removed; perhaps a fluke though)
            return RunInAction(actionName, funcThatChangesObservables);
        }, afterActionFunc);
        return false;
    }
}
export const RunInNextTick_BundledInOneAction_funcs = [];
export function RunInNextTick_BundledInOneAction(func, afterActionFunc) {
    const funcs = RunInNextTick_BundledInOneAction_funcs;
    funcs.push(func);
    if (funcs.length == 1) {
        WaitXThenRun(0, () => {
            RunInAction("SharedAction", () => {
                const funcs_copy = funcs.slice();
                funcs.length = 0;
                for (const func2 of funcs_copy) {
                    func2();
                }
            }, afterActionFunc);
        });
    }
}

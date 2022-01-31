import { runInAction, _getGlobalState } from "mobx";
import { WaitXThenRun } from "js-vextensions";
import { makeObservable } from "mobx";
export let _reactModule;
export function ProvideReactModule(reactModule) {
    _reactModule = reactModule;
}
export function makeObservable_safe(target, annotations, options) {
    if (annotations) {
        // for each annotated property, make sure the property exists (by setting it to undefined), else mobx will error
        for (let key of Object.keys(annotations)) {
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
export function RunInAction(name, action) {
    Object.defineProperty(action, "name", { value: name });
    return runInAction(action);
}
export function MobX_AllowStateChanges() {
    return MobX_GetGlobalState().allowStateChanges;
}
/** Supply the react module (using "ProvideReactModule(React)"") for this function to also protect from mobx-observable changes when a component is rendering. */
export function DoX_ComputationSafe(funcThatChangesObservables) {
    //const inMobXComputation = MobX_GetGlobalState().computationDepth > 0;
    /*const inMobXComputation = !MobX_GetGlobalState().allowStateChanges;
    const inReactRender = _reactModule?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner.current != null;*/
    // if we're not in a mobx computation or react-render call, just run the func immediately
    // (Can't change mobx observables within mobx computation, else mobx errors.)
    // (Can't change mobx observables within react-render, else change may trigger mobx to trigger a new react-render, which react dislikes and gives warning for.)
    //if (!inMobXComputation && !inReactRender) {
    if (MobX_AllowStateChanges()) {
        funcThatChangesObservables();
    }
    else {
        // else, wait till we're out of computation/render call-stack, *then* run it
        //WaitXThenRun(0, funcThatChangesObservables);
        // (use bundled version of setImmediate; this is important, because it allows multiple TreeNode.Request() calls to activate in the same tick -- preventing ancestor accessors from triggering for every tree-node's attachment)
        RunInNextTick_BundledInOneAction(funcThatChangesObservables);
    }
}
export let RunInNextTick_Bundled_AndInSharedAction_funcs = [];
export function RunInNextTick_BundledInOneAction(func) {
    const funcs = RunInNextTick_Bundled_AndInSharedAction_funcs;
    funcs.push(func);
    if (funcs.length == 1) {
        WaitXThenRun(0, () => {
            RunInAction("SharedAction", () => {
                for (const func of funcs) {
                    func();
                }
                funcs.length = 0;
            });
        });
    }
}

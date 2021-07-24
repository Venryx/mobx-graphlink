import { runInAction, _getGlobalState } from "mobx";
import { WaitXThenRun } from "js-vextensions";
export let _reactModule;
export function ProvideReactModule(reactModule) {
    _reactModule = reactModule;
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
        WaitXThenRun(0, funcThatChangesObservables);
    }
}

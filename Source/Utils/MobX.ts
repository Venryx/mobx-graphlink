import {_getGlobalState} from "mobx";
import {WaitXThenRun} from "js-vextensions";

export let _reactModule;
export function ProvideReactModule(reactModule: any) {
	_reactModule = reactModule;
}

/** Supply the react module (using "ProvideReactModule(React)"") for this function to also protect from mobx-observable changes when a component is rendering. */
export function DoX_ComputationSafe(funcThatChangesObservables: ()=>any) {
	const inMobXComputation = _getGlobalState().computationDepth > 0;
	const inReactRender = _reactModule?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner.current != null;
	// if we're not in a mobx computation or react-render call, just run the func immediately
	// (Can't change mobx observables within mobx computation, else mobx errors.)
	// (Can't change mobx observables within react-render, else change may trigger mobx to trigger a new react-render, which react dislikes and gives warning for.)
	if (!inMobXComputation && !inReactRender) {
		funcThatChangesObservables();
	} else {
		// else, wait till we're out of computation/render call-stack, *then* run it
		WaitXThenRun(0, funcThatChangesObservables);
	}
}
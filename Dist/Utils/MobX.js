import { _getGlobalState } from "mobx";
import { WaitXThenRun } from "js-vextensions";
export function DoX_ComputationSafe(funcThatChangesObservables) {
    // if we're not in a computation, just run the func immediately
    if (_getGlobalState().computationDepth == 0) {
        funcThatChangesObservables();
    }
    else {
        // else, wait till we're out of computation call-stack, *then* run it (we can't change observables from within computations)
        WaitXThenRun(0, funcThatChangesObservables);
    }
}

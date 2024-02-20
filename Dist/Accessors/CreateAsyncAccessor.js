import { createAtom } from "mobx";
import { CreateAccessor } from "./CreateAccessor.js";
// todo: maybe-make-so CreateAsyncAccessor accepts an `options` parameter, like `CreateAccessor` does
export class AsyncToObservablePack {
}
/** Warning: Do not reference any mobx-observable fields within the `accessorFunc`; instead, add a second accessor that retrieves that data, then passes them as arguments to the async-accessor. */
export function CreateAsyncAccessor(accessorFunc) {
    const packAccessor = CreateAccessor(function (callArgs) {
        const pack = {
            started: false,
            completionEvent: createAtom("completionEvent"),
            result: undefined,
            startIfNotYet: () => {
                if (pack.started)
                    return;
                pack.started = true;
                (async () => {
                    pack.result = await accessorFunc.apply(this, callArgs);
                    // notify the observer (the regular-accessor below) that the result has been set
                    pack.completionEvent.reportChanged();
                })();
            },
        };
        return pack;
    });
    return CreateAccessor(((...callArgs) => {
        const pack = packAccessor(callArgs);
        pack.startIfNotYet();
        pack.completionEvent.reportObserved(); // we want this accessor to re-run once the result is set (if result already set, this does nothing)
        return pack.result;
    }));
}

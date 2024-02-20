import { createAtom } from "mobx";
import { CreateAccessor } from "./CreateAccessor.js";
export class AsyncToObservablePack {
}
export function CreateAsyncAccessor(accessorFunc) {
    const packAccessor = CreateAccessor(function (...args) {
        const pack = {
            started: false,
            completionEvent: createAtom("completionEvent"),
            result: undefined,
            startIfNotYet: () => {
                if (pack.started)
                    return;
                pack.started = true;
                (async () => {
                    pack.result = await accessorFunc.apply(this, args);
                    // notify the observer (the regular-accessor below) that the result has been set
                    pack.completionEvent.reportChanged();
                })();
            },
        };
        return pack;
    });
    return CreateAccessor(((...args) => {
        const pack = packAccessor(...args);
        pack.startIfNotYet();
        pack.completionEvent.reportObserved(); // we want this accessor to re-run once the result is set (if result already set, this does nothing)
        return pack.result;
    }));
}

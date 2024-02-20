import {IAtom, createAtom} from "mobx";
import {CreateAccessor} from "./CreateAccessor.js";

export type AsyncReturnType<T extends (..._args: any) => Promise<any>> = Awaited<ReturnType<T>>;
export type NonAsyncVersionOfFunc<T extends (..._args: any) => Promise<any>> = (..._args: Parameters<T>)=>AsyncReturnType<T>;

// todo: maybe-make-so CreateAsyncAccessor accepts an `options` parameter, like `CreateAccessor` does

export class AsyncToObservablePack<T> {
	started: boolean;
	completionEvent: IAtom;
	result: T|undefined;
	startIfNotYet: ()=>void;
}

/** Warning: Do not reference any mobx-observable fields within the `accessorFunc`; instead, add a second accessor that retrieves that data, then passes them as arguments to the async-accessor. */
export function CreateAsyncAccessor<Func extends(...args: any[])=>Promise<any>>(accessorFunc: Func) {
	const packAccessor = CreateAccessor(function(callArgs) {
		const pack = {
			started: false,
			completionEvent: createAtom("completionEvent"),
			result: undefined as AsyncReturnType<Func>|undefined,
			startIfNotYet: ()=>{
				if (pack.started) return;
				pack.started = true;
				(async()=>{
					pack.result = await accessorFunc.apply(this, callArgs);

					// notify the observer (the regular-accessor below) that the result has been set
					pack.completionEvent.reportChanged();
				})();
			},
		};
		return pack;
	});

	return CreateAccessor(((...callArgs)=>{
		const pack = packAccessor(callArgs);
		pack.startIfNotYet();
		pack.completionEvent.reportObserved(); // we want this accessor to re-run once the result is set (if result already set, this does nothing)
		return pack.result;
	}) as NonAsyncVersionOfFunc<Func>);
}
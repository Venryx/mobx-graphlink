import {IAtom, createAtom} from "mobx";
import {CreateAccessor} from "./CreateAccessor.js";

export type AsyncReturnType<T extends (..._args: any) => Promise<any>> = Awaited<ReturnType<T>>;
export type NonAsyncVersionOfFunc<T extends (..._args: any) => Promise<any>> = (..._args: Parameters<T>)=>AsyncReturnType<T>;

export class AsyncToObservablePack<T> {
	started: boolean;
	completionEvent: IAtom;
	result: T|undefined;
	startIfNotYet: ()=>void;
}
export function CreateAsyncAccessor<Func extends(...args: any[])=>Promise<any>>(accessorFunc: Func) {
	const packAccessor = CreateAccessor(function(...args) {
		const pack = {
			started: false,
			completionEvent: createAtom("completionEvent"),
			result: undefined as AsyncReturnType<Func>|undefined,
			startIfNotYet: ()=>{
				if (pack.started) return;
				pack.started = true;
				(async()=>{
					pack.result = await accessorFunc.apply(this, args);

					// notify the observer (the regular-accessor below) that the result has been set
					pack.completionEvent.reportChanged();
				})();
			},
		};
		return pack;
	});

	return CreateAccessor(((...args)=>{
		const pack = packAccessor(...args);
		pack.startIfNotYet();
		pack.completionEvent.reportObserved(); // we want this accessor to re-run once the result is set (if result already set, this does nothing)
		return pack.result;
	}) as NonAsyncVersionOfFunc<Func>);
}
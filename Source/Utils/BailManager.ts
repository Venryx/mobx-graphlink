import {Assert, emptyArray_forLoading} from "js-vextensions";
import {ArgumentsType} from "updeep/types/types";

declare global {
	interface Function {
		/** The function itself, unchanged. */
		normal<Func extends ((..._: any)=>any)>(this: Func, ..._: ArgumentsType<Func>): ReturnType<Func>;

		/*#* Short for "bail unless". */
		//BU<Func extends ((..._: any)=>any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;

		/** Short for "bail if null". */
		BIN<Func extends ((..._: any)=>any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;

		/** Short for "bail if loading-array", ie. emptyArray_loading. */
		BILA<Func extends ((..._: any)=>any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;
	}
}
Object.defineProperty(Function.prototype, "normal", {get() { return this; }});
Object.defineProperty(Function.prototype, "BIN", function(this: Function, ...args) {
	const result = this.apply(null, args);
	BailIfNull(result, `Function "${this.name}" returned value ${result}, which violates a non-null type-guard. Execution will bubble-up until it hits a bail-handler. The caller will try again once the underlying data changes.`);
	return result;
});
Object.defineProperty(Function.prototype, "BILA", function(this: Function, ...args) {
	const result = this.apply(null, args);
	BailUnless(result != emptyArray_forLoading,
		`Function "${this.name}" returned value equal to emptyArray_loading, which violates a non-loading-array type-guard. Execution will bubble-up until it hits a bail-handler. The caller will try again once the underlying data changes.`);
	return result;
});

export class BailContext {
	onBail_triggerError = true;
	onBail_triggerDebugger = false;
}

export let bailContext: BailContext;

export function BailUnless(condition, messageOrMessageFunc?: string | Function | null): asserts condition {
	Assert(condition, messageOrMessageFunc as any /* temp */, bailContext.onBail_triggerDebugger);
	return true as any;
}
export const BU = BailUnless;
export function BailIfNull<T>(val: T, messageOrMessageFunc?: string | Function | null): NonNullable<T> {
	BailUnless(val != null, messageOrMessageFunc);
	return val as any;
}
export const BIN = BailIfNull;
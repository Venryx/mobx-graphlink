import {Assert, emptyArray_forLoading} from "js-vextensions";
import {ArgumentsType} from "updeep/types/types";
import {defaultGraphOptions} from "../../Graphlink.js";

export class BailMessage {
	static main = new BailMessage("[generic bail error]");

	constructor(public message: string) {}
}

/*
The process of "bailing", within a store-accessor stack:
1) Some layer finds that a piece of data it needs is not yet available, eg. mobx-graphlink sees a db-request still in progress, or a middle-layer sees something null which never should be (at least after all db-requests resolve).
2) It then "bails" the current call-stack, by throwing a special string. (usually done through Bail(), BailUnless(), BailIfNull(), MyAccessorFunc.BIN(), etc.)
3) For each middle layer/store-accessor-func reached as the bail "bubbles up":
3.A) The layer has the option of adding a bail-catcher (.CatchBail() or try-catch block), letting it, for example, selectively replace that entry with null (until the entry's data is done loading).
3.B) If it doesn't add a bail-catcher, then the accessor will check if there is a "bailResult" specified for it (eg: the "X" in "{onBail: X}"); if so, that is returned.
3.C) If no bail-catcher, and no bail-result specified, then the "bail error" is passed on to the level above.
4) If the bubbling-up continues all the way to a root-level accessor (eg. just below the React component or Command class), then:
4.A) Interpret this as meaning there is data "still loading", and show a loading UI.

Old:
4.A) Check if there are any db-requests that are still in-progress; if so, ignore the "bail error", as it's probably just due to not all data being loaded yet.
4.B) If there *aren't* any db-requests left, then there's probably an actual error/missing-db-data; so probably log/show the details then (to the user and/or devs).
*/

declare global {
	interface Function {
		/** The function itself, unchanged. */
		normal<Func extends ((..._: any)=>any)>(this: Func, ..._: ArgumentsType<Func>): ReturnType<Func>;

		/*#* Short for "bail unless". */
		//BU<Func extends ((..._: any)=>any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;

		/** Short for "bail if null". (in commands, generally use .NN instead, as bailing is for "still-loading" situations, which the db-accessors already handle) */
		BIN<Func extends ((..._: any)=>any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;

		/** Short for "bail if loading-array", ie. emptyArray_loading. */
		BILA<Func extends ((..._: any)=>any)>(this: Func, ..._: ArgumentsType<Func>): NonNullable<ReturnType<Func>>;
	}
}

// only set prototype methods if they don't already exist (ie. if this is the first copy of the mobx-graphlink lib being loaded)
if (Function.prototype.normal != null) {
	// if overrides already exist, it means this library must have been loaded more than once; warn
	console.warn("It appears that more than one copy of the mobx-graphlink package has been loaded, which is generally not desired."
		+ " If you're using mobx-graphlink in multiple places (eg. root project, and a library like graphql-feedback), make them resolve to the same path/instance:"
		+ ` For Webpack: Set the following in your config: config.resolve.alias = {"graphql-feedback": "<path to root project's copy of graphql-feedback>"}`
		+ ` For NodeJS (or as fallback in general): Have npm flatten the subdeps (ie. make sure versions match); if the lib using mobx-graphlink is symlinked,`
		+ 		" make sure that mobx-graphlink is symlinked as well (from both the root project and that local lib copy), so they resolve to the same path."
		+ 		` Note: The same-symlinked-mobx-graphlink approach can have some complications, where npm messes up its subdeps; if that happens, just run "npm install" in mobx-graphlink again.`);
} else {
	Object.defineProperty(Function.prototype, "normal", {get() { return this; }});
	Object.defineProperty(Function.prototype, "BIN", {value: function(this: Function, ...args) {
		const result = this.apply(null, args);
		BailIfNull(result, `Function "${this.name}" returned value ${result}, which violates a non-null type-guard. Execution will bubble-up until it hits a bail-handler. The caller will try again once the underlying data changes.`);
		return result;
	}});
	Object.defineProperty(Function.prototype, "BILA", {value: function(this: Function, ...args) {
		const result = this.apply(null, args);
		BailUnless(result != emptyArray_forLoading,
			`Function "${this.name}" returned value equal to emptyArray_loading, which violates a non-loading-array type-guard. Execution will bubble-up until it hits a bail-handler. The caller will try again once the underlying data changes.`);
		return result;
	}});
}

export class BailContext {
	onBail_triggerError = true;
	onBail_triggerDebugger = false;
}

export function CatchBail<T, ReturnTypeX>(bailResultOrGetter: T, func: (...args: any[])=>ReturnTypeX, args?: any[], thisArg?: any): NonNullable<ReturnTypeX> | (T extends (()=>any) ? ReturnType<T> : T) {
	let result;
	try {
		result = func.apply(thisArg, args);
	} catch (ex) {
		if (ex instanceof BailMessage) {
			const bailResult = bailResultOrGetter instanceof Function ? bailResultOrGetter() : bailResultOrGetter;
			return bailResult;
		} else {
			throw ex;
		}
	}
	return result;
};

export let bailContext: BailContext;
export function Bail(messageOrMessageFunc?: string | Function | null, triggerDebugger = false): never {
	let message = messageOrMessageFunc instanceof Function ? messageOrMessageFunc() : messageOrMessageFunc;
	if (message == null) {
		const lastRunAccessor_meta = defaultGraphOptions.graph.lastRunAccessor_meta;
		// if in accessor-call-stack, use that to make a more informative bail-message
		if (lastRunAccessor_meta) {
			//message = `[generic bail error, at: ${accessorCallStack.map(a=>GetAccessorName(a.meta.accessor)).join("->")}]`
			//message = `[generic bail error, at: ${accessorCallStack.map(a=>a.meta.accessor.name).join("->")}]`
			message = `[generic bail error, at: ${lastRunAccessor_meta.accessor.name ?? lastRunAccessor_meta.accessor.toString()}]`
		} else {
			message = "[generic bail error]";
		}
	}

	//const skipBail = false; // add flag which you can use to skip the bailing, when paused in debugger
	if (triggerDebugger) {
		debugger;
	}
	//if (!skipBail) {
	BailMessage.main.message = message;
	throw BailMessage.main;
	//}
	//return undefined as any;
}

export function BailUnless(condition, messageOrMessageFunc?: string | Function | null): asserts condition {
	//Assert(condition, messageOrMessageFunc as any /* temp */, bailContext.onBail_triggerDebugger);
	if (!condition) {
		Bail(messageOrMessageFunc);
	}
	return true as any;
}
export const BU = BailUnless;
export function BailIfNull<T>(val: T, messageOrMessageFunc?: string | Function | null): NonNullable<T> {
	BailUnless(val != null, messageOrMessageFunc);
	return val as any;
}
export const BIN = BailIfNull;
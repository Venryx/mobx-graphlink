import {StringCE, E} from "js-vextensions";
import {g} from "./@PrivateExports.js";

export function Assert(condition, messageOrMessageFunc?: string | Function): condition is true {
	if (condition) return true;

	var message = (messageOrMessageFunc as any) instanceof Function ? (messageOrMessageFunc as any)() : messageOrMessageFunc;

	//JSVE.logFunc(`Assert failed) ${message}\n\nStackTrace) ${GetStackTraceStr()}`);
	console.error("Assert failed) " + message);

	let skipError = false; // add flag which you can use to skip the error, when paused in debugger
	debugger;
	if (!skipError) throw new Error("Assert failed) " + message);
	return false;
}
export function AssertWarn(condition, messageOrMessageFunc?: string | Function) {
	if (condition) return;

	var message = messageOrMessageFunc instanceof Function ? messageOrMessageFunc() : messageOrMessageFunc;

	console.warn(`Assert-warn failed) ${message}\n\nStackTrace) ${GetStackTraceStr()}`);
}

//@((()=> { if (g.onclick == null) g.onclick = ()=>console.log(V.GetStackTraceStr()); }) as any)
export function GetStackTraceStr(opt?: {stackTrace?: string, sourceStackTrace?: boolean}) {
	opt = E({sourceStackTrace: true}, opt);

	//stackTrace = stackTrace || new Error()[sourceStackTrace ? "Stack" : "stack"];
	//stackTrace = stackTrace || (sourceStackTrace ? StackTrace.get().then(stack=>stackTrace = stack.map(a=>a.toString()).join("\n")) : new Error().stack);
	//stackTrace = stackTrace || new Error().stack;

	let stackTrace_final = opt!.stackTrace!;
	if (stackTrace_final == null) {
		//let fakeError = {}.VAct(a=>Error.captureStackTrace(a));
		let oldStackLimit = (Error as any).stackTraceLimit;
		(Error as any).stackTraceLimit = Infinity;

		let fakeError = new Error();
		stackTrace_final = fakeError.stack!;
		
		(Error as any).stackTraceLimit = oldStackLimit;
	}

	return stackTrace_final.substr(StringCE(stackTrace_final).IndexOf_X("\n", 1)); // remove "Error" line and first stack-frame (that of this method)
}

export function Log(...args) {
	return console.log(...args);
}

// maybe temp
export class LogTypes_Base {
	// from vwebapp-framework
	dbRequests = false;
	dbRequests_onlyFirst = false;
	cacheUpdates = false;
	commands = false;
	subscriptions = false;
}
export function ShouldLog_Base<LogTypes extends LogTypes_Base>(shouldLogFunc: (logTypes: LogTypes)=>boolean) {
	return shouldLogFunc(g["logTypes"] || {});
}
export function MaybeLog_Base<LogTypes extends LogTypes_Base>(shouldLogFunc: (logTypes: LogTypes)=>boolean, loggerFunc: (()=>string) | ((Log: Function)=>any)) {
	if (!ShouldLog_Base(shouldLogFunc)) return;
	// let loggerFuncReturnsString = loggerFunc.arguments.length == 0;
	const loggerFuncIsSimpleGetter = loggerFunc.toString().replace(/ /g, "").includes("function()");
	if (loggerFuncIsSimpleGetter) Log((loggerFunc as ()=>string)());
	else loggerFunc(Log);
}
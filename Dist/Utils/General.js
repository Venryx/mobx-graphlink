import { StringCE, E } from "js-vextensions";
import { g } from "./@PrivateExports.js";
export function Assert(condition, messageOrMessageFunc) {
    if (condition)
        return true;
    var message = messageOrMessageFunc instanceof Function ? messageOrMessageFunc() : messageOrMessageFunc;
    //JSVE.logFunc(`Assert failed) ${message}\n\nStackTrace) ${GetStackTraceStr()}`);
    console.error("Assert failed) " + message);
    let skipError = false; // add flag which you can use to skip the error, when paused in debugger
    debugger;
    if (!skipError)
        throw new Error("Assert failed) " + message);
    return false;
}
export function AssertWarn(condition, messageOrMessageFunc) {
    if (condition)
        return;
    var message = messageOrMessageFunc instanceof Function ? messageOrMessageFunc() : messageOrMessageFunc;
    console.warn(`Assert-warn failed) ${message}\n\nStackTrace) ${GetStackTraceStr()}`);
}
//@((()=> { if (g.onclick == null) g.onclick = ()=>console.log(V.GetStackTraceStr()); }) as any)
export function GetStackTraceStr(opt) {
    opt = E({ sourceStackTrace: true }, opt);
    //stackTrace = stackTrace || new Error()[sourceStackTrace ? "Stack" : "stack"];
    //stackTrace = stackTrace || (sourceStackTrace ? StackTrace.get().then(stack=>stackTrace = stack.map(a=>a.toString()).join("\n")) : new Error().stack);
    //stackTrace = stackTrace || new Error().stack;
    let stackTrace_final = opt.stackTrace;
    if (stackTrace_final == null) {
        //let fakeError = {}.VAct(a=>Error.captureStackTrace(a));
        let oldStackLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = Infinity;
        let fakeError = new Error();
        stackTrace_final = fakeError.stack;
        Error.stackTraceLimit = oldStackLimit;
    }
    return stackTrace_final.substr(StringCE(stackTrace_final).IndexOf_X("\n", 1)); // remove "Error" line and first stack-frame (that of this method)
}
export function Log(...args) {
    return console.log(...args);
}
// maybe temp
export class LogTypes_Base {
    constructor() {
        // from vwebapp-framework
        this.dbRequests = false;
        this.dbRequests_onlyFirst = false;
        this.cacheUpdates = false;
        this.commands = false;
        this.subscriptions = false;
    }
}
export function ShouldLog_Base(shouldLogFunc) {
    return shouldLogFunc(g["logTypes"] || {});
}
export function MaybeLog_Base(shouldLogFunc, loggerFunc) {
    if (!ShouldLog_Base(shouldLogFunc))
        return;
    // let loggerFuncReturnsString = loggerFunc.arguments.length == 0;
    const loggerFuncIsSimpleGetter = loggerFunc.toString().replace(/ /g, "").includes("function()");
    if (loggerFuncIsSimpleGetter)
        Log(loggerFunc());
    else
        loggerFunc(Log);
}
// this one doesn't work for objects nested in arrays
/*export function JSONStringify_NoQuotesForKeys(obj: Object) {
    if (typeof obj !== "object" || Array.isArray(obj)){
         // not an object, stringify using native function
         return JSON.stringify(obj);
    }
    // Implements recursive object serialization according to JSON spec
    // but without quotes around the keys.
    let props = Object
         .keys(obj)
         .map(key=>`${key}:${JSONStringify_NoQuotesForKeys(obj[key])}`)
         .join(",");
    return `{${props}}`;
}*/
// this one does (from: https://stackoverflow.com/a/65443215)
export function JSONStringify_NoQuotesForKeys(obj) {
    var cleaned = JSON.stringify(obj, null, 2);
    return cleaned.replace(/^[\t ]*"[^:\n\r]+(?<!\\)":/gm, match => {
        return match.replace(/"/g, "");
    });
}

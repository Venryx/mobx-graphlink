import { g } from "./@PrivateExports.js";
//export {Assert, AssertWarn, GetStackTraceStr} from "js-vextensions";
export function Log(...args) {
    return console.log(...args);
}
// maybe temp
export class LogTypes_Base {
    constructor() {
        // from vwebapp-framework
        Object.defineProperty(this, "dbRequests", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "dbRequests_onlyFirst", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "cacheUpdates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "commands", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "subscriptions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
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

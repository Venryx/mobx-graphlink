import { emptyArray_forLoading } from "js-vextensions";
export class BailMessage {
    constructor(message) {
        Object.defineProperty(this, "message", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: message
        });
    }
}
Object.defineProperty(BailMessage, "main", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new BailMessage("[generic bail error]")
});
// only set prototype methods if they don't already exist (ie. if this is the first copy of the mobx-graphlink lib being loaded)
if (Function.prototype.normal != null) {
    // if overrides already exist, it means this library must have been loaded more than once; warn
    console.warn("It appears that more than one copy of the mobx-graphlink package has been loaded, which is generally not desired."
        + " If you're using mobx-graphlink in multiple places (eg. root project, and a library like graphql-feedback), make them resolve to the same path/instance:"
        + ` For Webpack: Set the following in your config: config.resolve.alias = {"graphql-feedback": "<path to root project's copy of graphql-feedback>"}`
        + ` For NodeJS (or as fallback in general): Have npm flatten the subdeps (ie. make sure versions match); if the lib using mobx-graphlink is symlinked,`
        + " make sure that mobx-graphlink is symlinked as well (from both the root project and that local lib copy), so they resolve to the same path."
        + ` Note: The same-symlinked-mobx-graphlink approach can have some complications, where npm messes up its subdeps; if that happens, just run "npm install" in mobx-graphlink again.`);
}
else {
    Object.defineProperty(Function.prototype, "normal", { get() { return this; } });
    Object.defineProperty(Function.prototype, "BIN", { value: function (...args) {
            const result = this.apply(null, args);
            BailIfNull(result, `Function "${this.name}" returned value ${result}, which violates a non-null type-guard. Execution will bubble-up until it hits a bail-handler. The caller will try again once the underlying data changes.`);
            return result;
        } });
    Object.defineProperty(Function.prototype, "BILA", { value: function (...args) {
            const result = this.apply(null, args);
            BailUnless(result != emptyArray_forLoading, `Function "${this.name}" returned value equal to emptyArray_loading, which violates a non-loading-array type-guard. Execution will bubble-up until it hits a bail-handler. The caller will try again once the underlying data changes.`);
            return result;
        } });
}
export class BailContext {
    constructor() {
        Object.defineProperty(this, "onBail_triggerError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "onBail_triggerDebugger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
}
export function CatchBail(bailResultOrGetter, func, args, thisArg) {
    let result;
    try {
        result = func.apply(thisArg, args);
    }
    catch (ex) {
        if (ex instanceof BailMessage) {
            const bailResult = bailResultOrGetter instanceof Function ? bailResultOrGetter() : bailResultOrGetter;
            return bailResult;
        }
        else {
            throw ex;
        }
    }
    return result;
}
;
export let bailContext;
export function Bail(messageOrMessageFunc, triggerDebugger = false) {
    let message = messageOrMessageFunc instanceof Function ? messageOrMessageFunc() : messageOrMessageFunc;
    if (message == null) {
        /*const lastRunAccessor_meta = defaultGraphOptions.graph.lastRunAccessor_meta;
        // if in accessor-call-stack, use that to make a more informative bail-message
        if (lastRunAccessor_meta) {
            //message = `[generic bail error, at: ${accessorCallStack.map(a=>GetAccessorName(a.meta.accessor)).join("->")}]`
            //message = `[generic bail error, at: ${accessorCallStack.map(a=>a.meta.accessor.name).join("->")}]`
            message = `[generic bail error, at: ${lastRunAccessor_meta.accessor.name || lastRunAccessor_meta.accessor.toString()}]`
        } else {
            message = "[generic bail error]";
        }*/
        message = "[generic bail error]"; // additional info is inserted by the catch-block of CreateAccessor
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
export function BailUnless(condition, messageOrMessageFunc) {
    //Assert(condition, messageOrMessageFunc as any /* temp */, bailContext.onBail_triggerDebugger);
    if (!condition) {
        Bail(messageOrMessageFunc);
    }
    return true;
}
export const BU = BailUnless;
export function BailIfNull(val, messageOrMessageFunc) {
    BailUnless(val != null, messageOrMessageFunc);
    return val;
}
export const BIN = BailIfNull;

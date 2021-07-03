import { emptyArray_forLoading } from "js-vextensions";
export class BailMessage {
    constructor(message) {
        this.message = message;
    }
}
BailMessage.main = new BailMessage("[generic bail error]");
Object.defineProperty(Function.prototype, "normal", { get() { return this; } });
Object.defineProperty(Function.prototype, "BIN", function (...args) {
    const result = this.apply(null, args);
    BailIfNull(result, `Function "${this.name}" returned value ${result}, which violates a non-null type-guard. Execution will bubble-up until it hits a bail-handler. The caller will try again once the underlying data changes.`);
    return result;
});
Object.defineProperty(Function.prototype, "BILA", function (...args) {
    const result = this.apply(null, args);
    BailUnless(result != emptyArray_forLoading, `Function "${this.name}" returned value equal to emptyArray_loading, which violates a non-loading-array type-guard. Execution will bubble-up until it hits a bail-handler. The caller will try again once the underlying data changes.`);
    return result;
});
export class BailContext {
    constructor() {
        this.onBail_triggerError = true;
        this.onBail_triggerDebugger = false;
    }
}
export function CatchBail(bailResultOrGetter, func) {
    let result;
    try {
        result = func();
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
    var _a;
    const message = (_a = (messageOrMessageFunc instanceof Function ? messageOrMessageFunc() : messageOrMessageFunc)) !== null && _a !== void 0 ? _a : "[generic bail error]";
    const skipBail = false; // add flag which you can use to skip the bailing, when paused in debugger
    if (triggerDebugger) {
        debugger;
    }
    if (!skipBail) {
        BailMessage.main.message = message;
        throw BailMessage.main;
    }
    return undefined;
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

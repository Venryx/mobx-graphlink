import { Assert, emptyArray_forLoading } from "js-vextensions";
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
export let bailContext;
export function BailUnless(condition, messageOrMessageFunc) {
    Assert(condition, messageOrMessageFunc /* temp */, bailContext.onBail_triggerDebugger);
    return true;
}
export const BU = BailUnless;
export function BailIfNull(val, messageOrMessageFunc) {
    BailUnless(val != null, messageOrMessageFunc);
    return val;
}
export const BIN = BailIfNull;

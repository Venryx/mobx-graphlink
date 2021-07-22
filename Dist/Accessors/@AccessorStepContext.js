export class AccessorStepContext {
    constructor(graph) {
        // static getters, which return the values for the lowest store-accessor in the stack (assumed to be the level of the code asking for this data)
        //		(if not, eg. if one SA passes func to child SA, then parent SA needs to first cache/unwrap the data it wants, at start of its execution)
        // commented; for this to work, you would need to include the...
        this.accessorCallStack = [];
        this.graph = graph;
    }
    get store() {
        //return AccessorContext.liveValuesStack_current._store;
        return this.graph.storeOverridesStack.length == 0 ? this.graph.rootStore : this.graph.storeOverridesStack.slice(-1)[0];
    }
    ;
    get accessorCallStack_current() { return this.accessorCallStack[this.accessorCallStack.length - 1]; }
    get accessorMeta() {
        Assert(this.accessorCallStack.length);
        return this.accessorCallStack_current.meta;
    }
    get catchItemBails() {
        var _a;
        Assert(this.accessorCallStack.length);
        return (_a = this.accessorCallStack_current.catchItemBails) !== null && _a !== void 0 ? _a : false;
    }
    ;
    get catchItemBails_asX() {
        Assert(this.accessorCallStack.length);
        return this.accessorCallStack_current.catchItemBails_asX;
    }
    ;
    MaybeCatchItemBail(itemGetter) {
        if (this.catchItemBails) {
            return CatchBail(this.catchItemBails_asX, itemGetter);
        }
        return itemGetter();
    }
}
export class AccessorCallStackEntry {
}

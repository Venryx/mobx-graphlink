/*
Extracted from mobx-utils, for two reasons:
1) Upstream is missing a fix needed for it to work with func-result-caching where args-list is of variable length: https://github.com/mobxjs/mobx-utils/issues/232
2) mobx-utils does not export the "DeepMap" or "DeepMapEntry" classes. (tried just importing the deepMap.ts file, but then ts-node errors, since it thinks it's commonjs)
*/
export const $finalValue = Symbol("$finalValue");
export class DeepMap {
    constructor() {
        this.rootStore = new Map();
    }
    entry(args) {
        if (this.lastEntry)
            this.lastEntry.isDisposed = true;
        return (this.lastEntry = new DeepMapEntry(this, args.concat($finalValue)));
    }
}
export class DeepMapEntry {
    constructor(deepMap, args) {
        this.closestStore_depth = 0;
        this.isDisposed = false;
        this.deepMap = deepMap;
        this.args = args;
        let currentStore = deepMap.rootStore;
        this.closestStore = currentStore;
        let i = 0;
        for (; i < this.args.length - 1; i++) {
            currentStore = currentStore.get(args[i]);
            if (currentStore)
                this.closestStore = currentStore;
            else
                break;
        }
        this.closestStore_depth = i;
    }
    exists() {
        this.assertNotDisposed();
        const l = this.args.length;
        return this.closestStore_depth >= l - 1 && this.closestStore.has(this.args[l - 1]);
    }
    get() {
        this.assertNotDisposed();
        if (!this.exists())
            throw new Error("Entry doesn't exist");
        return this.closestStore.get(this.args[this.args.length - 1]);
    }
    set(value) {
        this.assertNotDisposed();
        const l = this.args.length;
        let current = this.closestStore;
        // create remaining maps
        for (let i = this.closestStore_depth; i < l - 1; i++) {
            const m = new Map();
            current.set(this.args[i], m);
            current = m;
        }
        this.closestStore_depth = l - 1;
        this.closestStore = current;
        current.set(this.args[l - 1], value);
    }
    delete() {
        this.assertNotDisposed();
        if (!this.exists())
            throw new Error("Entry doesn't exist");
        const l = this.args.length;
        this.closestStore.delete(this.args[l - 1]);
        // clean up remaining maps if needed (reconstruct stack first)
        let current = this.deepMap.rootStore;
        const maps = [current];
        for (let i = 0; i < l - 1; i++) {
            current = current.get(this.args[i]);
            maps.push(current);
        }
        for (let i = maps.length - 1; i > 0; i--) {
            if (maps[i].size === 0)
                maps[i - 1].delete(this.args[i - 1]);
        }
        this.isDisposed = true;
    }
    assertNotDisposed() {
        // TODO: once this becomes annoying, we should introduce a reset method to re-run the constructor logic
        if (this.isDisposed)
            throw new Error("Concurrent modification exception");
    }
}

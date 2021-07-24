/*
Extracted from mobx-utils, for two reasons:
1) Upstream is missing a fix needed for it to work with func-result-caching where args-list is of variable length: https://github.com/mobxjs/mobx-utils/issues/232
2) mobx-utils does not export the "DeepMap" or "DeepMapEntry" classes. (tried just importing the deepMap.ts file, but then ts-node errors, since it thinks it's commonjs)
*/
export class DeepMapEntry {
    constructor(base, args) {
        Object.defineProperty(this, "base", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: base
        });
        Object.defineProperty(this, "args", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: args
        });
        Object.defineProperty(this, "root", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "closest", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "closestIdx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "isDisposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        let current = (this.closest = this.root = base);
        let i = 0;
        for (; i < this.args.length - 1; i++) {
            current = current.get(args[i]);
            if (current)
                this.closest = current;
            else
                break;
        }
        this.closestIdx = i;
    }
    exists() {
        this.assertNotDisposed();
        const l = this.args.length;
        return this.closestIdx >= l - 1 && this.closest.has(this.args[l - 1]);
    }
    get() {
        this.assertNotDisposed();
        if (!this.exists())
            throw new Error("Entry doesn't exist");
        return this.closest.get(this.args[this.args.length - 1]);
    }
    set(value) {
        this.assertNotDisposed();
        const l = this.args.length;
        let current = this.closest;
        // create remaining maps
        for (let i = this.closestIdx; i < l - 1; i++) {
            const m = new Map();
            current.set(this.args[i], m);
            current = m;
        }
        this.closestIdx = l - 1;
        this.closest = current;
        current.set(this.args[l - 1], value);
    }
    delete() {
        this.assertNotDisposed();
        if (!this.exists())
            throw new Error("Entry doesn't exist");
        const l = this.args.length;
        this.closest.delete(this.args[l - 1]);
        // clean up remaining maps if needed (reconstruct stack first)
        let c = this.root;
        const maps = [c];
        for (let i = 0; i < l - 1; i++) {
            c = c.get(this.args[i]);
            maps.push(c);
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
export const $finalValue = Symbol("$finalValue");
export class DeepMap {
    constructor() {
        Object.defineProperty(this, "store", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "last", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
    entry(args) {
        if (this.last)
            this.last.isDisposed = true;
        return (this.last = new DeepMapEntry(this.store, args.concat($finalValue)));
    }
}

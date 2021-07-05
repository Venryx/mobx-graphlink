export declare class DeepMapEntry<T> {
    private base;
    private args;
    private root;
    private closest;
    private closestIdx;
    isDisposed: boolean;
    constructor(base: Map<any, any>, args: any[]);
    exists(): boolean;
    get(): T;
    set(value: T): void;
    delete(): void;
    private assertNotDisposed;
}
export declare const $finalValue: unique symbol;
export declare class DeepMap<T> {
    private store;
    private last;
    entry(args: any[]): DeepMapEntry<T>;
}

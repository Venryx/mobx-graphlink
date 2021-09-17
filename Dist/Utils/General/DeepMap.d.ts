export declare const $finalValue: unique symbol;
export declare class DeepMap<T> {
    rootStore: Map<any, any>;
    lastEntry: DeepMapEntry<T>;
    entry(args: any[]): DeepMapEntry<T>;
}
export declare class DeepMapEntry<T> {
    constructor(deepMap: DeepMap<any>, args: any[]);
    private deepMap;
    private args;
    private closestStore;
    private closestStore_depth;
    isDisposed: boolean;
    exists(): boolean;
    get(): T;
    set(value: T): void;
    delete(): void;
    private assertNotDisposed;
}

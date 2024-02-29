import { AnnotationsMap, CreateObservableOptions } from "mobx";
export declare let _reactModule: any;
export declare function ProvideReactModule(reactModule: any): void;
declare type NoInfer<T> = [T][T extends any ? 0 : never];
export declare function makeObservable_safe<T extends object, AdditionalKeys extends PropertyKey = never>(target: T, annotations?: AnnotationsMap<T, NoInfer<AdditionalKeys>>, options?: CreateObservableOptions): T;
export declare function MobX_GetGlobalState(): import("mobx/dist/internal.js").MobXGlobals;
export declare function RunInAction(name: string, action: () => any, afterActionFunc?: (actionErrored: boolean) => any): any;
export declare function MobX_AllowStateChanges(): boolean;
/**
 * Directly runs the passed-func, if in a computation-safe context (ie. if in a `runAction(...)` block); else, schedules it for running in one, using `RunInNextTick_BundledInOneAction(...)`.
 * Returns true if was able to run immediately; else, returns false.
 * */
export declare function RunInAction_WhenAble(actionName: string, funcThatChangesObservables: () => any, afterActionFunc?: () => any): boolean;
export declare const RunInNextTick_BundledInOneAction_funcs: Function[];
export declare function RunInNextTick_BundledInOneAction(func: Function, afterActionFunc?: () => any): void;
export {};

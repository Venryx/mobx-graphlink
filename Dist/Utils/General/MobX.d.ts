import { AnnotationsMap, CreateObservableOptions } from "mobx";
export declare let _reactModule: any;
export declare function ProvideReactModule(reactModule: any): void;
declare type NoInfer<T> = [T][T extends any ? 0 : never];
export declare function makeObservable_safe<T extends object, AdditionalKeys extends PropertyKey = never>(target: T, annotations?: AnnotationsMap<T, NoInfer<AdditionalKeys>>, options?: CreateObservableOptions): T;
export declare function MobX_GetGlobalState(): import("mobx/dist/internal.js").MobXGlobals;
export declare function RunInAction(name: string, action: () => any): any;
export declare function MobX_AllowStateChanges(): boolean;
/** Supply the react module (using "ProvideReactModule(React)"") for this function to also protect from mobx-observable changes when a component is rendering. */
export declare function DoX_ComputationSafe(funcThatChangesObservables: () => any): void;
export declare let RunInNextTick_Bundled_AndInSharedAction_funcs: Function[];
export declare function RunInNextTick_BundledInOneAction(func: Function): void;
export {};

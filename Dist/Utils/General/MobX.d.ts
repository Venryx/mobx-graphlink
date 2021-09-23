export declare let _reactModule: any;
export declare function ProvideReactModule(reactModule: any): void;
export declare function MobX_GetGlobalState(): import("mobx/dist/internal.js").MobXGlobals;
export declare function RunInAction(name: string, action: () => any): any;
export declare function MobX_AllowStateChanges(): boolean;
/** Supply the react module (using "ProvideReactModule(React)"") for this function to also protect from mobx-observable changes when a component is rendering. */
export declare function DoX_ComputationSafe(funcThatChangesObservables: () => any): void;
export declare let RunInNextTick_Bundled_AndInSharedAction_funcs: Function[];
export declare function RunInNextTick_BundledInOneAction(func: Function): void;

export declare let _reactModule: any;
export declare function ProvideReactModule(reactModule: any): void;
/** Supply the react module (using "ProvideReactModule(React)"") for this function to also protect from mobx-observable changes when a component is rendering. */
export declare function DoX_ComputationSafe(funcThatChangesObservables: () => any): void;

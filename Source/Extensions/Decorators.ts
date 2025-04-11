import {Assert, CE, E} from "js-vextensions";
import React, {Suspense} from "react";
import {reaction} from "mobx";
import {AddSchema, collection_docSchemaName, WaitTillSchemaAdded} from "./JSONSchemaHelpers.js";
import {BailError} from "../Utils/General/BailManager.js";
import {n} from "../Utils/@Internal/Types.js";
import {Graphlink, TreeRequestWatcher} from "../index.js";

// metadata-retrieval helpers
// ==========

export function TableNameToDocSchemaName(tableName: string, errorIfMissing = true) {
	//if (ObjectCE(this.treeNode.type).IsOneOf(TreeNodeType.Collection, TreeNodeType.CollectionQuery)) {
	const docSchemaName = collection_docSchemaName.get(tableName);
	if (errorIfMissing) Assert(docSchemaName, `No schema has been associated with collection "${tableName}". Did you forget the \`@MGLClass({table: "tableName"})\` decorator?`);
	return docSchemaName!;
}
export function TableNameToGraphQLDocRetrieverKey(tableName: string) {
	//return ModifyString(this.DocSchemaName, m=>[m.startUpper_to_lower, m.underscoreUpper_to_underscoreLower]);
	return tableName.replace(/ies$/, "y").replace(/s$/, "");
}

// ui stuff
// ==========

export let BailHandler_loadingUI_default: BailHandler = ()=>null;
export function BailHandler_loadingUI_default_Set(value: BailHandler) {
	BailHandler_loadingUI_default = value;
}

export type BailInfo = {comp: any, bailMessage: BailError|n};
export type BailHandler = (info: BailInfo)=>any;
export class BailHandler_Options {
	loadingUI?: BailHandler;
	storeMetadata = true;
}
export function BailHandler(targetClass: Function);
export function BailHandler(options?: Partial<BailHandler_Options>);
export function BailHandler(...args) {
	let opts = new BailHandler_Options();
	if (typeof args[0] == "function") {
		ApplyToClass(args[0]);
	} else {
		opts = E(opts, args[0]);
		return ApplyToClass;
	}

	function ApplyToClass(targetClass: Function) {
		const render_old = targetClass.prototype.render;
		targetClass.prototype.render = function(...args_inner) {
			if (opts.storeMetadata && this["mgl"] == null) this["mgl"] = new MGLCompMeta();
			const mgl = this["mgl"] as MGLCompMeta|undefined;

			// strategy 1: throw error (doesn't work in react 19 / with actual hooks in-use)
			/*try {
				if (mgl) mgl.NotifyRenderStart();
				const result = render_old.apply(this, args_inner);

				if (mgl) mgl.NotifyRenderCompletion();
				return result;
			} catch (ex) {
				if (ex instanceof BailError) {
					if (mgl) mgl.NotifyBailError(ex);

					const loadingUI = this.loadingUI ?? targetClass.prototype.loadingUI ?? opts.loadingUI ?? BailHandler_loadingUI_default;
					return loadingUI.call(this, {comp: this, bailMessage: ex}); // current v-pref is to have loading-uis not care about the "this" passed, but kept same for now (doesn't hurt anything)
				}
				throw ex;
			}*/

			// strategy 2: throw error, but make it look like a promise rejection (while also wrapping render func's return in a Suspense)
			const loadingUI_final = opts.loadingUI ?? BailHandler_loadingUI_default;
			let stashedBailError: BailError|n;
			const loadingUI_final_asFuncComp = ()=>{
				return loadingUI_final({comp: this, bailMessage: stashedBailError});
			};
			const func_withBailConvertedToThrownPromise = ()=>{
				try {
					if (mgl) mgl.NotifyRenderStart();
					const result = render_old.apply(this, args_inner);

					if (mgl) mgl.NotifyRenderCompletion();
					return result;
				} catch (ex) {
					if (ex instanceof BailError) {
						if (mgl) mgl.NotifyBailError(ex);

						stashedBailError = ex;
						ex["then"] = ()=>{}; // make react think this is a react suspense-error
						throw ex;
					} else {
						stashedBailError = null;
					}
					throw ex;
				}
			};
			return React.createElement(
				Suspense,
				{fallback: React.createElement(loadingUI_final_asFuncComp)},
				func_withBailConvertedToThrownPromise(),
			);

			// TODO: Maybe update this class-based version to also have the <func_withBailConvertedToThrownPromise> as a child-comp, rather than a func we just call directly (so our new Suspense can wrap it).
			// (The complication is that doing so would make the original render-func have to be called with an unclear "this" object; using the wrapper-instance would be conceptually confusing, and constructing a fake instance would also be confusing.)
			// (The other complication is that it would sorta require BailHandler to be merged with ObserverMGL, since the observer would need to be applied to the new child-comp, rather than the original render-func.)
			// EDIT: For now, I'm just going to leave this as-is; while it doesn't catch bail-errors at the ideal granularity, it at least doesn't error out on react 19. (which is good enough since I'll be moving to func-comps everywhere anyway)
		};
	}
}

export class RenderResultSpan {
	bailMessage: string|n;
	accessorInfo: string|n;
	startTime: number;
	endTime?: number;
	duration?: number;
}
export class MGLCompMeta {
	timeOfFirstRenderAttempt?: number;
	timeOfFirstRenderSuccess?: number;
	renderResultSpans: RenderResultSpan[] = [];

	NotifyRenderStart() {
		this.timeOfFirstRenderAttempt = this.timeOfFirstRenderAttempt ?? Date.now();
	}
	NotifyRenderCompletion() {
		this.timeOfFirstRenderSuccess = this.timeOfFirstRenderSuccess ?? Date.now();
		this.NotifyRenderResult(null);
	}
	NotifyBailError(ex: BailError) {
		this.NotifyRenderResult(ex.message);
	}
	NotifyRenderResult(bailMessage: string|null) {
		const lastResultSpan = CE(this.renderResultSpans).LastOrX();
		if (bailMessage != lastResultSpan?.bailMessage) {
			const now = Date.now();
			if (lastResultSpan != null) {
				lastResultSpan.endTime = now;
				lastResultSpan.duration = now - lastResultSpan.startTime;
			}
			let accessorInfo: string|null = null;
			if (bailMessage && bailMessage.includes("@accessor:")) {
				accessorInfo = bailMessage.split("@accessor:")[1]
					.replace(/\(0,[a-zA-Z0-9_]+?\.GetDocs\)/g, "GetDocs")
					.replace(/\(0,[a-zA-Z0-9_]+?\.GetDoc\)/g, "GetDoc");
			}
			this.renderResultSpans.push({
				bailMessage,
				accessorInfo,
				startTime: now,
			});
		}
	}

	// to be called from dev-tools console (eg: `$r.mtg.BailDurations()`)
	//BailDurations() {}
}

let observer: typeof import("mobx-react").observer;
declare var __webpack_require__;
function WP_ImportSync(name_ending: string) {
	// Try to dynamically lazy import. Use import() to hint webpack we want to code split this module, but the "real" import needs to be synchronous.
	//import(`@/data/posts/${this.props.matches.slug}`);

	//require(...) doesn't work
	//return __webpack_require__(require.resolve(name));
	const moduleID = Object.keys(__webpack_require__.m).find(a=>a.endsWith(name_ending));
	return __webpack_require__(moduleID);
}
function EnsureImported_MobXReact() {
	// if in NodeJS, return an empty decorator (NodeJS doesn't provide __webpack_require__ func, and lib should be NodeJS-safe at parse-time; fine since NodeJS/server won't actually use these observers)
	if (typeof window == "undefined" || typeof document == "undefined") {
		observer = function PlaceholderForNodeJS() {} as any;
	}

	//observer = observer ?? (await import("mobx-react")).observer;
	//observer = observer ?? WP_ImportSync("mobx-react").observer;
	observer = observer ?? WP_ImportSync("/mobx-react/dist/mobxreact.esm.js").observer;
}

export class ObserverMGL_Options {
	graphlink: Graphlink<any, any>|n;
	bailHandler = true;
	bailHandler_opts?: Partial<BailHandler_Options>;
	observer = true;
}
/** Variant of mobx-react's `observer` function (for comp-classes), which also adds bail-handling behavior. */
export function ObserverMGL(targetClass: Function);
export function ObserverMGL(options: Partial<ObserverMGL_Options>|n);
export function ObserverMGL(...args) {
	EnsureImported_MobXReact();

	let opts = new ObserverMGL_Options();
	if (typeof args[0] == "function") {
		ApplyToClass(args[0]);
	} else {
		opts = E(opts, args[0]);
		return ApplyToClass;
	}

	function ApplyToClass(targetClass: Function) {
		if (opts.bailHandler) BailHandler(opts.bailHandler_opts)(targetClass);
		if (opts.observer) observer(targetClass as any);
	}
}

/** Variant of mobx-react's `observer` function (for render-funcs), which also adds bail-handling behavior. */
export function observer_mgl<T>(func: React.FC<T>): React.FC<T>;
export function observer_mgl<T>(options: Partial<ObserverMGL_Options>|n, func: React.FC<T>): React.FC<T>;
export function observer_mgl(...args) {
	EnsureImported_MobXReact();

	let opts = new ObserverMGL_Options();
	let func: React.FC<any>;
	if (args[1] == null) {
		func = args[0];
	} else {
		opts = E(opts, args[0]);
		func = args[1];
	}

	if (opts.bailHandler) {
		// strategy 1: throw error (doesn't work in react 19 / with actual hooks in-use)
		/*return observer(props=>{
			try {
				return func(props);
			} catch (ex) {
				if (ex instanceof BailError) {
					const loadingUI_final = opts.bailHandler_opts?.loadingUI ?? BailHandler_loadingUI_default;
					return loadingUI_final({comp: {name: "unknown", props}, bailMessage: ex});
				}
				throw ex;
			}
		});*/

		// strategy 2: throw error, but make it look like a promise rejection (while also wrapping render func's return in a Suspense)
		return props=>{
			const loadingUI_final = opts.bailHandler_opts?.loadingUI ?? BailHandler_loadingUI_default;
			let stashedBailError: BailError|n;
			const loadingUI_final_asFuncComp = ()=>{
				return loadingUI_final({comp: {name: "unknown", regularCompFunc: func, props}, bailMessage: stashedBailError});
			};

			const func_withBailConvertedToThrownPromise = observer(props_inner=>{
				const graphlink = opts.graphlink ?? Graphlink.instances[0];
				const watcher = new TreeRequestWatcher(graphlink);

				watcher.Start();
				try {
					return func(props_inner);
				} catch (ex) {
					if (ex instanceof BailError) {
						stashedBailError = ex;

						//ex["then"] = ()=>{}; // make react think this is a react suspense-error
						// attach a "then" function, making reaction think this is a promise (which it then calls to attach its "when data has changed" listener)
						ex["then"] = reactDataChangeListener=>{
							const reactionDisposer = reaction(
								// First function tracks the observables and returns their values
								()=>{
									let pathsNotReady = 0;
									for (const treeNodeOrPlaceholder of watcher.nodesRequested) {
										const treeNode = graphlink.tree.Get(treeNodeOrPlaceholder.path, true)!;
										// make access attempt in the same way that GetDoc/GetDocs does
										const _data = treeNode.DocDatas_ForDirectSubscriber;
										const _dataAcceptableToConsume = treeNode.PreferredDataContainer.IsDataAcceptableToConsume();
										if (!_dataAcceptableToConsume) pathsNotReady++;

										// extra accesses
										/*JSON.stringify(treeNode.data_fromParent);
										JSON.stringify(treeNode.data_fromSelf);
										CE(treeNode).IncludeKeys("Data_ForDirectSubscriber", "DocDatas_ForDirectSubscriber", "self_subscriptionStatus", "PreferredDataContainer", "PreferredData", "DocDatas", "collectionNodes", "queryNodes", "docNodes");*/
									}
									return pathsNotReady;
								},
								// Second function is called when any value changes
								pathsNotReady=>{
									// call the react-data-change-listener; this will cause react to re-render (using the regular render-comp-func) in a moment
									reactDataChangeListener();
									if (pathsNotReady == 0) {
										// so now we can stop our reaction/mgl-watcher (the regular render-comp-func will attach its owner watchers in a moment)
										reactionDisposer();
									}
								},
							);
						};

						throw ex;
					} else {
						stashedBailError = null;
					}
					throw ex;
				} finally {
					watcher.Stop();
				}
			});

			return React.createElement(
				Suspense,
				{fallback: React.createElement(loadingUI_final_asFuncComp, {regularCompFunc: func})}, // redundantly attached as prop here, just for easier discovery in react dev-tools 
				React.createElement(func_withBailConvertedToThrownPromise, props),
			);
		};

		// strategy 3: catch error and replace by throwing a promise instead (still stash the error so the loading-ui knows what the error was though)
		/*return observer(props=>{
			const loadingUI_final = opts.bailHandler_opts?.loadingUI ?? BailHandler_loadingUI_default;
			let stashedBailError: BailError|n;
			const loadingUI_final_asFuncComp = ()=>loadingUI_final({comp: {name: "unknown", props}, bailMessage: stashedBailError});

			const func_withBailConvertedToThrownPromise = ()=>{
				try {
					return func(props);
				} catch (ex) {
					if (ex instanceof BailError) {
						stashedBailError = ex;
						throw new Promise((resolve, reject)=>{
							reject(ex);
						});
					}
					throw ex;
				}
			};

			/*<Suspense fallback={()=>loadingUI_final({comp: {name: "unknown", props}, bailMessage: null})}>
				{func()}
			</Suspense>*#/
			return React.createElement(
				Suspense,
				{fallback: React.createElement(loadingUI_final_asFuncComp)},
				func_withBailConvertedToThrownPromise(),
			);
		});*/
	}
	return observer(func);
}

// db stuff
// ==========

/*export function Table(docSchemaName: string) {
	return ApplyToClass;
	function ApplyToClass<T>(targetClass: T, propertyKey: string) {
		collection_docSchemaName.set(propertyKey, docSchemaName);
	}
}*/

export const mglClasses = [] as Function[];
export function GetMGLClass(name: string) {
	return mglClasses.find(a=>a.name == name);
}

export function MGLClass(
	opts?: {name?: string, table?: string, schemaDeps?: string[]},
	schemaExtrasOrGetter?: Object | (()=>Object),
) {
	return (constructor: Function)=>{
		Assert(!mglClasses.includes(constructor));
		mglClasses.push(constructor);
		const typeName = opts?.name ?? constructor.name;
		const schemaDeps = opts?.schemaDeps;

		if (opts?.table) {
			collection_docSchemaName.set(opts.table, typeName);
			constructor["_table"] = opts.table;
		}

		AddSchema(typeName, schemaDeps, ()=>{
			const schema = schemaExtrasOrGetter instanceof Function ? schemaExtrasOrGetter() : (schemaExtrasOrGetter ?? {} as any);
			schema.properties = schema.properties ?? {};
			for (const [key, fieldSchemaOrGetter] of Object.entries(constructor["_fields"] ?? [])) {
				let fieldSchema = fieldSchemaOrGetter instanceof Function ? fieldSchemaOrGetter() : fieldSchemaOrGetter;
				const extras = constructor["_fieldExtras"]?.[key] as Field_Extras;
				if (extras?.opt) {
					const fieldSchemaKeys = Object.keys(fieldSchema);
					if (fieldSchemaKeys.length == 1 && fieldSchemaKeys[0] == "type") {
						const fieldTypes = (Array.isArray(fieldSchema.type) ? fieldSchema.type : [fieldSchema.type]);
						const alreadyAcceptsNull = fieldTypes.includes("null");
						if (!alreadyAcceptsNull) {
							fieldSchema.type = fieldTypes.concat("null");
						}
					} else {
						fieldSchema = {
							anyOf: [fieldSchema, {type: "null"}],
						};
					}
				} else {
					schema.required = schema.required ?? [];
					schema.required.push(key);
				}
				schema.properties[key] = fieldSchema;
			}
			return schema;
		});
	};
}

export type Field_Extras = {
	/** If true, two changes are made:
	1) Field is removed from the list of required properties. (fields are required by default)
	2) Field's schema is changed to accept either the listed type, or null. (as elsewhere, null and undefined/not-present are meant to be treated the same) */
	opt?: boolean;
	/*#* If specified, the given graphql type will be used for this field, within the Command-classes' graphql definitions. */
	//graphqlType?: string;
};
/**
Marks the given field to be part of the json-schema for the current class.
Note that the "requiredness" of properties should be based on what's valid for an entry during submission to the database (ie. within the type's main AddXXX command);
	this is different than the TS "?" marker, which should match with the requiredness of the property when already in the db. (for new entries, the TS constructors already make all props optional)
*/
export function Field(schemaOrGetter: Object | (()=>Object), extras?: Field_Extras) {
	//return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
	return function(target: any, propertyKey: string) {
		const constructor = target.constructor;
		constructor["_fields"] = constructor["_fields"] ?? {};
		constructor["_fields"][propertyKey] = schemaOrGetter;

		if (extras) {
			constructor["_fieldExtras"] = constructor["_fieldExtras"] ?? {};
			constructor["_fieldExtras"][propertyKey] = extras;
		}
	};
}
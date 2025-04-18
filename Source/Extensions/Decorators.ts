import {Assert, CE, E} from "js-vextensions";
import React, {Suspense, useEffect, useMemo, useRef, useState} from "react";
import {reaction} from "mobx";
import {observer} from "mobx-react";
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

type observer_mgl_Self = {
	normalComp_bailError: BailError|n, // todo: probably remove this (in case of bail-error that does not replicate in LoadingUIProxy's render, we'll be kicked back to normal-comp anyway, so storing this is unnecessary)
	suspenseComp_lastResult: React.ReactNode|n,
};

/** Variant of mobx-react's `observer` function (for render-funcs), which also adds bail-handling behavior. */
export function observer_mgl<T>(func: React.FC<T>): React.FC<T>;
export function observer_mgl<T>(options: Partial<ObserverMGL_Options>|n, func: React.FC<T>): React.FC<T>;
export function observer_mgl(...args) {
	let opts = new ObserverMGL_Options();
	let func: React.FC<any>;
	if (args[1] == null) {
		func = args[0];
	} else {
		opts = E(opts, args[0]);
		func = args[1];
	}

	let wrapperFunc: React.FC<any>;
	if (opts.bailHandler) {
		wrapperFunc = props=>{
			const self = useMemo(()=>({
				normalComp_bailError: null as BailError|n,
				suspenseComp_lastResult: null as React.ReactNode|n,
			}), []);

			const loadingUI_final = opts.bailHandler_opts?.loadingUI ?? BailHandler_loadingUI_default;
			const [suspenseKickBacks, setSuspenseKickBacks] = useState(0);
			return React.createElement(
				Suspense,
				{
					fallback: React.createElement(
						Suspense,
						{
							// in this edge-case (triggered by async useState().setVal called after LoadingUIProxy first renders), just display same loading-ui result returned by LoadingUIProxy (may not show very-latest mgl bail-error/state, but better than an empty space)
							fallback: React.createElement(LoadingUIFallback, {
								observer_mgl_self: self,
							}),
						},
						React.createElement(LoadingUIProxy, {
							key: `suspense_${suspenseKickBacks}`, // change key each time; this is how we avoid the react "hook order changed" warning
							normalComp: func, // redundantly attached as prop here, just for easier discovery in react dev-tools
							normalCompProps: props,
							loadingUI: loadingUI_final,
							kickBack: ()=>setSuspenseKickBacks(suspenseKickBacks + 1),
							observer_mgl_self: self,
						}),
					),
				},
				React.createElement(NormalCompProxy, {
					key: `normalComp_${suspenseKickBacks}`,
					normalComp: func,
					normalCompProps: props,
					observer_mgl_self: self,
				}),
			);
		};
	} else {
		wrapperFunc = observer(func);
	}
	wrapperFunc["innerRenderFunc"] = func;
	return wrapperFunc;
}
export function GetInnermostRenderFunc(renderFunc: React.FunctionComponent): React.FunctionComponent {
	let result = renderFunc;
	while (result["innerRenderFunc"]) {
		result = result["innerRenderFunc"];
	}
	return result;
}

const NormalCompProxy = observer((props: {normalComp: React.FunctionComponent, normalCompProps: any, observer_mgl_self: observer_mgl_Self})=>{
	const {normalComp, normalCompProps, observer_mgl_self} = props;
	const normalComp_innermostRenderFunc = GetInnermostRenderFunc(normalComp);

	try {
		return normalComp_innermostRenderFunc(normalCompProps);
	} catch (ex) {
		if (ex instanceof BailError) {
			ex["then"] = ()=>{}; // make react think this is a react suspense-error (no need to call this callback; rerender will happen when mobx-reactive fallback comp calls kickBack())
			observer_mgl_self.normalComp_bailError = ex;
			throw ex;
		}
		throw ex;
	}
});
const LoadingUIProxy = (props: {normalComp: React.FunctionComponent, normalCompProps: any, loadingUI: BailHandler, kickBack: (/*error: any*/)=>any, observer_mgl_self: observer_mgl_Self})=>{
	const {normalComp, normalCompProps, loadingUI, kickBack, observer_mgl_self} = props;
	const normalComp_innermostRenderFunc = GetInnermostRenderFunc(normalComp);

	const self = useMemo(()=>({
		reactionTrackerTriggers: 0,
		stashedBailError: null as any,
		reactionDisposer: null as (()=>any)|n,
		kickBackDone: false,
		kickBack_oneTime: ()=>{
			if (self.kickBackDone) return;
			self.kickBackDone = true;
			self.reactionDisposer!();
			kickBack();
		},
	}), []);
	if (self.reactionDisposer == null) {
		self.reactionDisposer = reaction(
			()=>{
				if (self.reactionTrackerTriggers > 0) return {}; // return new object, so reaction-half triggers any time this tracker-half reruns
				self.reactionTrackerTriggers++;

				let hitError = false;
				try {
					normalComp_innermostRenderFunc(normalCompProps);
					// if we didn't hit a bail-error, we can just immediately kick back to regular rendering!
					if (!hitError) {
						setTimeout(()=>self.kickBack_oneTime());
					}
				} catch (ex) {
					hitError = true;
					if (ex instanceof BailError) {
						self.stashedBailError = ex; // ignore/simply-store bail-error during first render (we called `func` simply to subscribe to the same mobx accesses)
					} else {
						//self.stashedBailError = ex;
						throw ex;
					}
				}
				return {}; // return new object, so reaction-half triggers any time this tracker-half reruns
			},
			// whenever the mobx data accessed by normal-comp render-func (called independently above) changes, kick-back to normal-comp for react-rendering
			()=>{
				self.kickBack_oneTime();
			},
		);
	} else {
		// if reaction is already running, this is an "extraneous render" (caused by an unwanted update from the innermost render-func), which we have no need for
		// so just ensure kick-back has started, AND throw a promise (emulating a suspense) that never resolves [just to make sure we don't trigger the "hook order changed" warning]
		setTimeout(()=>self.kickBack_oneTime(), 0);
		throw new Promise(()=>{});
	}

	useEffect(()=>{
		return ()=>void (self.reactionDisposer!());
	}, []);

	const result = loadingUI({comp: {name: normalComp.displayName || normalComp.name || "unknown", normalComp, normalCompProps}, bailMessage: self.stashedBailError ?? observer_mgl_self.normalComp_bailError});
	observer_mgl_self.suspenseComp_lastResult = result;
	return result;
};
const LoadingUIFallback = (props: {observer_mgl_self: observer_mgl_Self})=>{
	return props.observer_mgl_self.suspenseComp_lastResult ?? null;
};

/*function useIsFirstRender() {
	const isFirstRender = useRef(true);
	if (isFirstRender.current) {
		isFirstRender.current = false;
		return true;
	}
	return false;
}*/

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
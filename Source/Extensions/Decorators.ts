import {AddSchema, collection_docSchemaName, WaitTillSchemaAdded} from "./JSONSchemaHelpers.js";
import type {Knex} from "knex";
import {BailError} from "../Utils/General/BailManager.js";
import {Assert, CE, E} from "js-vextensions";
import {n} from "../Utils/@Internal/Types.js";

// metadata-retrieval helpers
// ==========

export function TableNameToDocSchemaName(tableName: string, errorIfMissing = true) {
	//if (ObjectCE(this.treeNode.type).IsOneOf(TreeNodeType.Collection, TreeNodeType.CollectionQuery)) {
	const docSchemaName = collection_docSchemaName.get(tableName);
	if (errorIfMissing) Assert(docSchemaName, `No schema has been associated with collection "${tableName}". Did you forget the \`@Table("DOC_SCHEMA_NAME")\` decorator?`);
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

export type BailInfo = {comp: any, bailMessage: BailError};
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
		targetClass.prototype.render = function(...args) {
			if (opts.storeMetadata && this["mgl"] == null) this["mgl"] = new MGLCompMeta();
			const mgl = this["mgl"] as MGLCompMeta|undefined;
			try {
				if (mgl) mgl.NotifyRenderStart();
				const result = render_old.apply(this, args);
				
				if (mgl) mgl.NotifyRenderCompletion();
				return result;
			} catch (ex) {
				if (ex instanceof BailError) {
					if (mgl) mgl.NotifyBailError(ex);

					const loadingUI = this.loadingUI ?? targetClass.prototype.loadingUI ?? opts.loadingUI ?? BailHandler_loadingUI_default;
					return loadingUI.call(this, {comp: this, bailMessage: ex});
				} else {
					throw ex;
				}
			}
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
		let lastResultSpan = CE(this.renderResultSpans).LastOrX();
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
				startTime: now
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

export class MGLObserver_Options {
	bailHandler = true;
	bailHandler_opts?: BailHandler_Options;
}
export function MGLObserver(targetClass: Function);
export function MGLObserver(options: Partial<MGLObserver_Options>|n);
export function MGLObserver(...args) {
	EnsureImported_MobXReact();
	
	let opts = new MGLObserver_Options();
	if (typeof args[0] == "function") {
		ApplyToClass(args[0]);
	} else {
		opts = E(opts, args[0]);
		return ApplyToClass;
	}

	function ApplyToClass(targetClass: Function) {
		if (opts.bailHandler) BailHandler(opts.bailHandler_opts)(targetClass);
		observer(targetClass as any);
	}
}

// db stuff
// ==========

/*export function Table(docSchemaName: string) {
	return ApplyToClass;
	function ApplyToClass<T>(targetClass: T, propertyKey: string) {
		collection_docSchemaName.set(propertyKey, docSchemaName);
	}
}*/

export const mglClasses = new Array<Function>();
export function GetMGLClass(name: string) {
	return mglClasses.find(a=>a.name == name);
}

export function MGLClass(
	opts?: {name?: string, table?: string, schemaDeps?: string[]},
	schemaExtrasOrGetter?: Object | (()=>Object),
	initFunc_pre?: (t: Knex.TableBuilder)=>any,
) {
	return (constructor: Function)=>{
		Assert(!mglClasses.includes(constructor));
		mglClasses.push(constructor);
		const typeName = opts?.name ?? constructor.name;
		const schemaDeps = opts?.schemaDeps;

		if (opts?.table) {
			collection_docSchemaName.set(opts.table, typeName);
			constructor["_table"] = opts.table;
			if (initFunc_pre) constructor["_initFunc_pre"] = initFunc_pre;
		}

		AddSchema(typeName, schemaDeps, ()=>{
			let schema = schemaExtrasOrGetter instanceof Function ? schemaExtrasOrGetter() : (schemaExtrasOrGetter ?? {} as any);
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

// this is needed so DeferRef() can be called in the "@DB(...)" decorators, in user-project code, without TS complaining
export type DeferRef_Options = {enforceAtTransactionEnd?: boolean};
declare module "knex" {
	namespace Knex {
		interface ColumnBuilder {
			DeferRef: (this: Knex.ColumnBuilder, opts?: DeferRef_Options)=>Knex.ColumnBuilder; 
		}
	}
}

export type DBInitFunc = (t: Knex.TableBuilder, n: string)=>any;
/**
Marks the given field to be a database column for the current class. (ie. in its generated table definition)
Note that "notNullable()" is called for these fields automatically; if you want it to be optional/nullable within the db, add ".nullable()" to the chain.
*/
export function DB(initFunc: DBInitFunc) {
	//return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
	return function(target: any, propertyKey: string) {
		const constructor = target.constructor;
		constructor["_fieldDBInits"] = constructor["_fieldDBInits"] ?? {};
		constructor["_fieldDBInits"][propertyKey] = initFunc;
	};
}
export function GetFieldDBInit(constructor: Function, fieldName: string): DBInitFunc|undefined {
	return (constructor["_fieldDBInits"] ?? {})[fieldName];
}
import {AddSchema, collection_docSchemaName, WaitTillSchemaAdded} from "./SchemaHelpers.js";
import {Knex} from "knex";
import {BailMessage} from "../Utils/General/BailManager.js";
import {Assert, E} from "js-vextensions";

// metadata-retrieval helpers
// ==========

export function TableNameToDocSchemaName(tableName: string, errorIfMissing = true) {
	//if (ObjectCE(this.treeNode.type).IsOneOf(TreeNodeType.Collection, TreeNodeType.CollectionQuery)) {
	const docSchemaName = collection_docSchemaName.get(this.CollectionName);
	if (errorIfMissing) Assert(docSchemaName, `No schema has been associated with collection "${this.CollectionName}". Did you forget the \`@Table("DOC_SCHEMA_NAME")\` decorator?`);
	return docSchemaName!;
}
export function TableNameToGraphQLDocRetrieverKey(tableName: string) {
	//return ModifyString(this.DocSchemaName, m=>[m.startUpper_to_lower, m.underscoreUpper_to_underscoreLower]);
	return this.CollectionName.replace(/ies$/, "y").replace(/s$/, "");
}

// ui stuff
// ==========

export let BailHandler_loadingUI_default: BailHandler = ()=>null;
export function BailHandler_loadingUI_default_Set(value: BailHandler) {
	BailHandler_loadingUI_default = value;
}

export type BailInfo = {comp: any, bailMessage: BailMessage};
export type BailHandler = (info: BailInfo)=>any;
export class BailHandler_Options {
	loadingUI?: BailHandler;
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
			try {
				const result = render_old.apply(this, args);
				return result;
			} catch (ex) {
				if (ex instanceof BailMessage) {
					const loadingUI = targetClass.prototype.loadingUI ?? opts.loadingUI ?? BailHandler_loadingUI_default;
					return loadingUI({comp: this, bailMessage: ex});
				} else {
					throw ex;
				}
			}
		};
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

export function MGLClass(
	opts?: {name?: string, table?: string, schemaDeps?: string[]},
	schemaExtrasOrGetter?: Object | (()=>Object),
	initFunc_pre?: (t: Knex.TableBuilder)=>any,
) {
	return (constructor: Function)=>{
		const typeName = opts?.name ?? constructor.name;
		const schemaDeps = opts?.schemaDeps;

		if (opts?.table) {
			collection_docSchemaName.set(opts.table, typeName);
			constructor["_table"] = opts.table;
			if (initFunc_pre) constructor["_initFunc_pre"] = initFunc_pre;
		}

		// schema-adding logic (do at end, so rest can complete synchronously)
		// ==========
		
		(async()=>{
			if (schemaDeps! != null) await Promise.all(schemaDeps.map(schemaName=>WaitTillSchemaAdded(schemaName)));

			let schema = schemaExtrasOrGetter instanceof Function ? schemaExtrasOrGetter() : (schemaExtrasOrGetter ?? {} as any);
			schema.properties = schema.properties ?? {};
			for (const [key, fieldSchemaOrGetter] of Object.entries(constructor["_fields"] ?? [])) {
				schema.properties[key] = fieldSchemaOrGetter instanceof Function ? fieldSchemaOrGetter() : fieldSchemaOrGetter;
				const extras = constructor["_fieldExtras"]?.[key];
				if (extras?.required) {
					schema.required = schema.required ?? [];
					schema.required.push(key);
				}
			}
	
			AddSchema(typeName, schemaDeps, schema);
		})();
	};
}

export type Field_Extras = {
	/** If true, field will be added to the list of required properties. */
	req?: boolean;
};
export function Field(schemaOrGetter: Object | (()=>Object), extras?: Field_Extras) {
	//return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
	return function(target: any, propertyKey: string) {
		const constructor = target.constructor;
		constructor["_fields"] = constructor["_fields"] ?? {};
		constructor["_fields"][propertyKey] = schemaOrGetter;

		if (extras) {
			constructor["_fieldExtras"] = constructor["_fields"] ?? {};
			constructor["_fieldExtras"][propertyKey] = extras;
		}
	};
}

/*interface Object {
	DeferRef: (this: Knex.ColumnBuilder)=>Knex.ColumnBuilder;
}*/
// this is needed so DeferRef() can be called in the "@DB(...)" decorators, in user-project code, without TS complaining
declare module "knex" {
	namespace Knex {
		interface ColumnBuilder {
			DeferRef: (this: Knex.ColumnBuilder)=>Knex.ColumnBuilder; 
		}
	}
}
export function DB(initFunc: (t: Knex.TableBuilder, n: string)=>any) {
	//return function(target: Function, propertyKey: string, descriptor: PropertyDescriptor) {
	return function(target: any, propertyKey: string) {
		const constructor = target.constructor;
		constructor["_fieldDBInits"] = constructor["_fieldDBInits"] ?? {};
		constructor["_fieldDBInits"][propertyKey] = initFunc;
	};
}
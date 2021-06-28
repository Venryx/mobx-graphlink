import {AddSchema, collection_docSchemaName, WaitTillSchemaAdded} from "./SchemaHelpers.js";
import {Knex} from "knex";

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
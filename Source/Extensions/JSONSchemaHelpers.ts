import AJV from "ajv";
import AJVKeywords from "ajv-keywords";
import {Clone, ToJSON, IsString, Assert, IsObject, E, CE, IsArray, DEL} from "js-vextensions";
import {JSONSchema4, JSONSchema7, JSONSchema7Object, JSONSchema7Type} from "json-schema";
import {AssertV} from "../Accessors/Helpers.js";
import {UUID_regex} from "./KeyGenerator.js";
//import {RemoveHelpers, WithoutHelpers} from "./DatabaseHelpers.js";

export const ajv = AJVKeywords(new AJV({allErrors: true})) as AJV_Extended;

export const collection_docSchemaName = new Map<string, string>(); // populated by funcs in Decorators.ts

// needed so that apollo knows postgraphile get-single-doc queries can be found in cache simply by typename and id (eg. as cached from collection-based query results)
export function GetTypePolicyFieldsMappingSingleDocQueriesToCache() {
	const result = {};
	for (const [collectionName, docSchemaName] of collection_docSchemaName.entries()) {
		//const singularName = collectionName.replace(/s$/, "");
		const singularName = docSchemaName.toLowerCase();
		result[singularName] = (_, {args, toReference})=>{
			return toReference({
				__typename: docSchemaName,
				id: args.id,
			});
		};
	}
	return result;
}

export function NewSchema(schema) {
	schema = E({additionalProperties: false}, schema);
	return schema;
}
type JSONSchemaProperties = {[k: string]: JSONSchema7}; // taken from @types/json-schema
/*export function SimpleSchema(props: JSONSchemaProperties, required?: string[]) {
	const schema: JSONSchema7 = {
		properties: props,
	};
	if (required) schema.required = required;
	return NewSchema(schema);
}*/
/** Specify required props by adding a "$" to the start of the prop name. */
export function SimpleSchema(props: JSONSchemaProperties) {
	const schema: JSONSchema7 = {
		properties: {},
		required: [],
	};
	for (const [key, value] of Object.entries(props)) {
		const key_final = key.replace("$", "");
		schema.properties![key_final] = value;
		if (key.startsWith("$")) {
			schema.required?.push(key_final);
		}
	}
	return NewSchema(schema);
}

export const schemaEntryJSONs = {};
export async function AddSchema(name: string, schemaOrGetter: JSONSchema7 | (()=>JSONSchema7));
export async function AddSchema(name: string, schemaDeps: string[] | undefined, schemaGetter: ()=>JSONSchema7); // only accept schema-getter, since otherwise there's no point to adding the dependency-schemas
export async function AddSchema(...args: any[]) {
	let name: string, schemaDeps: string[], schemaOrGetter: any;
	if (args.length == 2) [name, schemaOrGetter] = args;
	else [name, schemaDeps, schemaOrGetter] = args;

	if (schemaDeps! != null) {
		const schemaDep_waitPromises = schemaDeps.map(schemaName=>WaitTillSchemaAdded(schemaName));
		// only await promises if there actually are schema-deps that need waiting for (avoid promises if possible, so AddSchema has chance to synchronously complete)
		if (schemaDep_waitPromises.find(a=>a != null)) {
			await Promise.all(schemaDep_waitPromises);
		}
	}
	let schema = schemaOrGetter instanceof Function ? schemaOrGetter() : schemaOrGetter;

	schema = NewSchema(schema);
	schemaEntryJSONs[name] = schema;
	ajv.removeSchema(name); // for hot-reloading
	const result = ajv.addSchema(schema, name);

	if (schemaAddListeners[name]) {
		for (const listener of schemaAddListeners[name]) {
			listener();
		}
		delete schemaAddListeners[name];
	}

	return result;
}

export function GetSchemaJSON(name: string): JSONSchema7 {
	return Clone(schemaEntryJSONs[name]);
}

export type SchemaModifiers = {
	includeOnly?: string[]
};
export function DeriveJSONSchema(typeName: string, modifiers: SchemaModifiers): Object {
	const result = Clone(GetSchemaJSON(typeName));
	if (modifiers.includeOnly) {
		for (const key of Object.keys(result.properties)) {
			if (!modifiers.includeOnly.includes(key)) {
				delete result.properties[key];
			}
		}
		if (result.required) result.required = result.required.Including(...modifiers.includeOnly);
	}
	return result;
}

/*export type DataWrapper<T> = {data: T};
export function DataWrapper(dataSchema: any) {
	return {
		properties: {
			data: dataSchema,
		},
		required: ['data'],
	};
}
export function WrapData<T>(data: T) {
	return { data } as DataWrapper<T>;
}*/

var schemaAddListeners = {};
export function WaitTillSchemaAdded(schemaName: string): Promise<void> | null {
	// if schema is already added, return right away (avoid promises if possible, so AddSchema has chance to synchronously complete)
	if (schemaEntryJSONs[schemaName] != null) return null;

	return new Promise((resolve, reject)=>{
		// if schema is already added, run right away (avoid ajv.getSchema, since it errors on not-yet-resolvable refs)
		//if (ajv.getSchema(schemaName)) {
		if (schemaEntryJSONs[schemaName] != null) {
			resolve();
			return;
		}
		schemaAddListeners[schemaName] = (schemaAddListeners[schemaName] || []).concat(resolve);
	});
}

/*export type SchemaObject = {
	[key: string]: any;
	// this has the effect of excluding an array as a valid SchemaObject, which is what we want
	[key: number]: never;
};
export type SchemaPropChange = "allow delete";

export function DeriveSchema(baseSchemaNameOrJSON: string | Object, schemaPropsToInclude_withChanges: {[key: string]: SchemaPropChange[] | SchemaObject}) {
	const baseSchemaName = IsString(baseSchemaNameOrJSON) ? baseSchemaNameOrJSON : null;
	const baseSchemaObject = IsString(baseSchemaNameOrJSON) ? GetSchemaJSON(baseSchemaName!) : baseSchemaNameOrJSON;

	let newSchema = {properties: {}};
	for (let pair of CE(schemaPropsToInclude_withChanges).Pairs()) {
		let change = pair.value;
		if (IsArray(change)) {
			let newPropSchema = baseSchemaObject.properties[pair.key];
			if (change.includes("allow delete")) {
				newPropSchema = {oneOf: [newPropSchema, {const: DEL.toString()}]};
			}
			newSchema.properties[pair.key] = newPropSchema;
		} else {
			newSchema.properties[pair.key] = change;
		}
	}
	return newSchema;
}*/

type AJV_Extended = AJV.Ajv & {
	// AddSchema(schema, name: string): void;
	FullErrorsText(): string;
};
/* AJV.prototype.AddSchema = function(this: AJV_Extended, schema, name: string) {
	return `${this.errorsText()} (${ToJSON(this.errors)})`;
}; */
AJV.prototype.FullErrorsText = function(this: AJV_Extended) {
	return `${this.errorsText()}

Details: ${ToJSON(this.errors, undefined, 3)}
`;
};

// validation
// ==========

export type AJVExtraCheckFunc = (item: any)=>string;
export const ajvExtraChecks = {} as {[key: string]: AJVExtraCheckFunc[]}; // schemaName -> $index -> $validationFunc
export function AddAJVExtraCheck(schemaName: string, extraCheckFunc: AJVExtraCheckFunc) {
	ajvExtraChecks[schemaName] = ajvExtraChecks[schemaName] || [];
	ajvExtraChecks[schemaName].push(extraCheckFunc);
}
export function ValidateAJVExtraChecks(schemaName: string, data) {
	if (ajvExtraChecks[schemaName] == null) return null;
	for (const extraCheck of ajvExtraChecks[schemaName]) {
		const errorMessage = extraCheck(data);
		if (errorMessage) return errorMessage;
	}
}

/** Returns null if the supplied data matches the schema. Else, returns error message. */
export function Validate(schemaName: string, data: any) {
	return Validate_Full(GetSchemaJSON(schemaName), schemaName, data);
}
/** Returns null if the supplied data matches the schema. Else, returns error message. */
export function Validate_Full(schemaObject: JSONSchema7, schemaName: string|null, data: any) {
	const isEmptySchema = Object.keys(schemaObject.properties ?? {}).length == 0; // example: {additionalProperties: false, type: "object", properties: {}}
	if (data == null && !isEmptySchema) return "Data is null/undefined!";

	const passed = ajv.validate(schemaObject, data);
	if (!passed) return ajv.FullErrorsText();

	// additional, non-ajv checks
	if (schemaName) {
		return ValidateAJVExtraChecks(schemaName, data);
	}
}

export class AssertValidateOptions {
	addErrorsText = true;
	addSchemaName = true;
	addSchemaObject = false;
	addDataStr = true;
	allowOptionalPropsToBeNull = true;
	useAssertV = true;
}
export function AssertValidate(schemaNameOrJSON: string | JSONSchema7, data, failureMessageOrGetter: string | ((errorsText: string)=>string), opt?: Partial<AssertValidateOptions>) {
	const schemaName = IsString(schemaNameOrJSON) ? schemaNameOrJSON : null;
	const schemaObject = IsString(schemaNameOrJSON) ? GetSchemaJSON(schemaName!) : schemaNameOrJSON;
	return AssertValidate_Full(schemaObject, schemaName, data, failureMessageOrGetter, opt);
}
export function AssertValidate_Full(schemaObject: JSONSchema7, schemaName: string|null, data, failureMessageOrGetter: string | ((errorsText: string|undefined)=>string), opt?: Partial<AssertValidateOptions>) {
	opt = E(new AssertValidateOptions(), opt);
	AssertV(schemaObject != null, "schemaObject cannot be null.");
	schemaObject = NewSchema(schemaObject); // make sure we apply schema-object defaults
	if (opt.allowOptionalPropsToBeNull) {
		schemaObject = Schema_WithOptionalPropsAllowedNull(schemaObject);
	}

	const errorsText = Validate_Full(schemaObject, schemaName, data)?.replace(/\s+$/, ""); //.trimEnd();

	let failureMessage = IsString(failureMessageOrGetter) ? failureMessageOrGetter : failureMessageOrGetter(errorsText);
	if (opt.addErrorsText) {
		failureMessage += `: ${errorsText}`;
	}
	if (opt.addSchemaName && schemaName) {
		failureMessage += `\nSchemaName: "${schemaName}"`;
	}
	if (opt.addSchemaObject) {
		failureMessage += `\nSchemaObject: "${JSON.stringify(schemaObject, null, 2)}"`;
	}
	if (opt.addDataStr) {
		failureMessage += `\nData: ${ToJSON(data, undefined, 3)}`;
	}
	failureMessage += "\n";

	if (opt.useAssertV) {
		AssertV(errorsText == null, failureMessage);
	} else {
		Assert(errorsText == null, failureMessage);
	}
}

export function Schema_WithOptionalPropsAllowedNull(schema: any) {
	const result = Clone(schema);
	for (const {key: propName, value: propSchema} of (result.properties || {}).Pairs()) {
		const propOptional = result.required == null || !result.required.Contains(propName);
		if (propOptional && propSchema.type) {
			propSchema.type = CE(IsString(propSchema.type) ? ["null", propSchema.type] : ["null"].concat(propSchema.type)).Distinct();
		}
	}
	return result;
}

/*export function GetInvalidPropPaths(obj: Object, schemaObj: Object, checkForExtraneous = true, checkForNotMatching = true, ignoreParentsOfInvalids = true) {
	Assert(IsObject(schemaObj), "schemaObj must be an object. (eg. result from GetSchemaJSON)");
	const result = [];
	for (const pair of obj.Pairs()) {
		const propSchema_raw = (schemaObj["properties"] || {})[pair.key];
		const propSchema = propSchema_raw && propSchema_raw["$ref"] ? GetSchemaJSON(propSchema_raw["$ref"]) : propSchema_raw;

		const selfInvalid =
			(checkForExtraneous && propSchema == null) ||
			(checkForNotMatching && propSchema && Validate_Full(propSchema, null, pair.value) != null);

		// if object (and we have schema-data available for this level), look for invalid prop-paths within it
		if (IsObject(pair.value) && propSchema) {
			const subResults = GetInvalidPropPaths(pair.value, propSchema);
			if (!ignoreParentsOfInvalids || subResults.length == 0) result.push(pair.key);
			result.push(...subResults.map(subPath=>`${pair.key}/${subPath}`));
		} else {
			if (selfInvalid) result.push(pair.key);
		}
	}
	return result;
}*/
export function GetInvalidPropPaths(data: Object, schemaObject: Object) {
	const passed = ajv.validate(schemaObject, data);
	if (passed) return [];

	return ajv.errors!.map(error=>{
		let propPath = error.dataPath
			.replace(/^\./, "") // remove starting dot
			.replace(/[.[\]]/g, "/") // replace instances of ".", "[", and "]" with "/"
			.replace(/\/+/g, "/"); // collapse each sequence of "/" into a single "/" (can be caused by: "arrayProp[0].prop" -> "arrayProp/0//prop")
		if (error.keyword == "additionalProperties") {
			propPath += `/${error.params["additionalProperty"]}`;
		}
		return {propPath, error};
	});
}

// hoisted schema definitions (eg. so other files, eg. KeyGenerator.ts, can be imported standalone)
// ==========

AddSchema("UUID", {type: "string", pattern: UUID_regex});
import Ajv from "ajv";
import AJVKeywords from "ajv-keywords";
import { Clone, ToJSON, IsString, Assert, E, CE, ArrayCE } from "js-vextensions";
import { AssertV } from "../Accessors/Helpers.js";
import { UUID_regex } from "./KeyGenerator.js";
//import {RemoveHelpers, WithoutHelpers} from "./DatabaseHelpers.js";
export const ajv = AJVKeywords(new Ajv({ allErrors: true }));
ajv.addKeyword("$gqlType");
ajv.addKeyword("$gqlTypeIsScalar");
ajv.addKeyword("$noWrite");
export const collection_docSchemaName = new Map(); // populated by funcs in Decorators.ts
// needed so that apollo knows postgraphile get-single-doc queries can be found in cache simply by typename and id (eg. as cached from collection-based query results)
export function GetTypePolicyFieldsMappingSingleDocQueriesToCache() {
    const result = {};
    for (const [collectionName, docSchemaName] of collection_docSchemaName.entries()) {
        //const singularName = collectionName.replace(/s$/, "");
        const singularName = docSchemaName.toLowerCase();
        result[singularName] = (_, { args, toReference }) => {
            return toReference({
                __typename: docSchemaName,
                id: args.id,
            });
        };
    }
    return result;
}
export function NewSchema(schema, allowInferTypeObject = true) {
    schema = E(allowInferTypeObject && (schema.type == "object" || (schema.type == null && schema.properties != null)) && {
        // need this to avoid warning (regarding "additionalProperties" being used without "type:object")
        type: "object",
        additionalProperties: false,
    }, schema);
    // temp; makes-so schemas are understandable by get-graphql-from-jsonschema
    /*if (convertEnumToOneOfConst && schema.enum) {
        schema.type = "string";
        schema.oneOf = schema.enum.map(val=>({const: val}));
        delete schema.enum;
    }*/
    return schema;
}
/*export function SimpleSchema(props: JSONSchemaProperties, required?: string[]) {
    const schema: JSONSchema7 = {
        properties: props,
    };
    if (required) schema.required = required;
    return NewSchema(schema);
}*/
/** Specify required props by adding a "$" to the start of the prop name. */
export function SimpleSchema(props) {
    var _a;
    const schema = {
        properties: {},
        required: [],
    };
    for (const [key, value] of Object.entries(props)) {
        const key_final = key.replace("$", "");
        schema.properties[key_final] = value;
        if (key.startsWith("$")) {
            (_a = schema.required) === null || _a === void 0 ? void 0 : _a.push(key_final);
        }
    }
    return NewSchema(schema);
}
export const schemaEntryJSONs = new Map();
export function AddSchema(...args) {
    var _a;
    let name, schemaDeps, schemaOrGetter;
    if (args.length == 2)
        [name, schemaOrGetter] = args;
    else
        [name, schemaDeps, schemaOrGetter] = args;
    schemaDeps = (_a = schemaDeps) !== null && _a !== void 0 ? _a : [];
    /*if (schemaDeps! != null) {
        const schemaDep_waitPromises = schemaDeps.map(schemaName=>WaitTillSchemaAdded(schemaName));
        // only await promises if there actually are schema-deps that need waiting for (avoid promises if possible, so AddSchema has chance to synchronously complete)
        if (schemaDep_waitPromises.find(a=>a != null)) {
            await Promise.all(schemaDep_waitPromises);
        }
    }*/
    let ajvResult;
    const proceed = () => {
        let schema = schemaOrGetter instanceof Function ? schemaOrGetter() : schemaOrGetter;
        schema = NewSchema(schema);
        schemaEntryJSONs.set(name, schema);
        ajv.removeSchema(name); // for hot-reloading
        ajvResult = ajv.addSchema(schema, name);
        if (schemaAddListeners.has(name)) {
            for (const listener of schemaAddListeners.get(name)) {
                listener();
            }
            schemaAddListeners.delete(name);
        }
    };
    // if schema cannot be added just yet (due to a schema-dependency not yet being added)
    if (!schemaDeps.every(dep => schemaEntryJSONs.has(dep))) {
        // set up schema-adding func to run as soon as possible (without even leaving call-stack)
        RunXOnceSchemasAdded(schemaDeps, proceed);
        // return promise that then provides the ajv instance as this func's return-value (this part can have slight delay)
        return new Promise(async (resolve) => {
            await WaitTillSchemaAdded(name);
            resolve(ajvResult);
        });
    }
    // if schema *can* be completed added synchronously, then do so and return the ajv instance (no need for promise)
    proceed();
    return ajvResult;
}
export function GetSchemaJSON(name, errorOnMissing = true) {
    const schemaJSON = schemaEntryJSONs.get(name);
    Assert(schemaJSON != null || !errorOnMissing, `Could not find schema "${name}".`);
    return Clone(schemaJSON);
}
export function DeriveJSONSchema(typeClass, modifiers) {
    var _a, _b;
    const result = Clone(GetSchemaJSON(typeClass.name));
    if (modifiers.includeOnly) {
        for (const key of Object.keys(result.properties)) {
            if (!modifiers.includeOnly.includes(key)) {
                delete result.properties[key];
            }
        }
        if (result.required)
            result.required = ArrayCE(result.required).Include(...modifiers.includeOnly);
    }
    if (modifiers.makeOptional) {
        if (result.required)
            result.required = ArrayCE(result.required).Exclude(...modifiers.makeOptional);
    }
    if (modifiers.makeOptional_all) {
        delete result.required;
    }
    if (modifiers.makeRequired) {
        result.required = CE([...((_a = result.required) !== null && _a !== void 0 ? _a : []), ...modifiers.makeRequired]).Distinct();
    }
    if (modifiers.makeRequired_all) {
        result.required = CE([...((_b = result.required) !== null && _b !== void 0 ? _b : []), Object.keys(result.properties)]).Distinct();
    }
    return result;
}
/** Helper for compile-time type-checking. At runtime, it simply returns the passed-in key-array. */
/*export function ClassKeys<T extends {[key: string]: any}>(type: new(..._)=>T, keys: Array<keyof T>) {
    return keys;
}*/
export function ClassKeys(...keys) {
    return keys;
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
var schemaAddListeners = new Map();
export function RunXOnceSchemasAdded(schemaDeps, funcX) {
    const schemasLeftToWaitFor = new Set(schemaDeps);
    for (const schemaDep of schemaDeps) {
        if (!schemaAddListeners.has(schemaDep))
            schemaAddListeners.set(schemaDep, []);
        schemaAddListeners.get(schemaDep).push(() => {
            schemasLeftToWaitFor.delete(schemaDep);
            if (schemasLeftToWaitFor.size == 0) {
                funcX();
            }
        });
    }
}
/*export function RunXOnceSchemaAdded(schemaName: string, funcX: ()=>void) {
    RunXOnceSchemasAdded([schemaName], funcX);
}*/
export function WaitTillSchemaAdded(schemaName) {
    // if schema is already added, return right away (avoid promises if possible, so AddSchema has chance to synchronously complete)
    if (schemaEntryJSONs.has(schemaName))
        return null;
    return new Promise((resolve, reject) => {
        RunXOnceSchemasAdded([schemaName], resolve);
    });
}
/* AJV.prototype.AddSchema = function(this: AJV_Extended, schema, name: string) {
    return `${this.errorsText()} (${ToJSON(this.errors)})`;
}; */
Ajv.prototype["FullErrorsText"] = function () {
    return `${this.errorsText()}

Details: ${ToJSON(this.errors, undefined, 3)}
`;
};
export const ajvExtraChecks = {}; // schemaName -> $index -> $validationFunc
export function AddAJVExtraCheck(schemaName, extraCheckFunc) {
    ajvExtraChecks[schemaName] = ajvExtraChecks[schemaName] || [];
    ajvExtraChecks[schemaName].push(extraCheckFunc);
}
export function ValidateAJVExtraChecks(schemaName, data) {
    if (ajvExtraChecks[schemaName] == null)
        return null;
    for (const extraCheck of ajvExtraChecks[schemaName]) {
        const errorMessage = extraCheck(data);
        if (errorMessage)
            return errorMessage;
    }
}
/** Returns null if the supplied data matches the schema. Else, returns error message. */
export function Validate(schemaName, data) {
    return Validate_Full(GetSchemaJSON(schemaName), schemaName, data);
}
/** Returns null if the supplied data matches the schema. Else, returns error message. */
export function Validate_Full(schemaObject, schemaName, data) {
    var _a;
    const isEmptySchema = Object.keys((_a = schemaObject.properties) !== null && _a !== void 0 ? _a : {}).length == 0; // example: {additionalProperties: false, type: "object", properties: {}}
    if (data == null && !isEmptySchema)
        return "Data is null/undefined!";
    const passed = ajv.validate(schemaObject, data);
    if (!passed)
        return ajv.FullErrorsText();
    // additional, non-ajv checks
    if (schemaName) {
        return ValidateAJVExtraChecks(schemaName, data);
    }
}
export class AssertValidateOptions {
    constructor() {
        this.addErrorsText = true;
        this.addSchemaName = true;
        this.addSchemaObject = false;
        this.addDataStr = true;
        this.allowOptionalPropsToBeNull = true;
        this.useAssertV = true;
    }
}
export function AssertValidate(schemaNameOrJSON, data, failureMessageOrGetter, opt) {
    const schemaName = IsString(schemaNameOrJSON) ? schemaNameOrJSON : null;
    const schemaObject = IsString(schemaNameOrJSON) ? GetSchemaJSON(schemaName) : schemaNameOrJSON;
    return AssertValidate_Full(schemaObject, schemaName, data, failureMessageOrGetter, opt);
}
export function AssertValidate_Full(schemaObject, schemaName, data, failureMessageOrGetter, opt) {
    var _a;
    opt = E(new AssertValidateOptions(), opt);
    const assertFunc = opt.useAssertV ? AssertV : Assert;
    assertFunc(schemaObject != null, "schemaObject cannot be null.");
    schemaObject = NewSchema(schemaObject); // make sure we apply schema-object defaults
    if (opt.allowOptionalPropsToBeNull) {
        schemaObject = Schema_WithOptionalPropsAllowedNull(schemaObject);
    }
    const errorsText = (_a = Validate_Full(schemaObject, schemaName, data)) === null || _a === void 0 ? void 0 : _a.replace(/\s+$/, ""); //.trimEnd();
    let failureMessage = IsString(failureMessageOrGetter) ? failureMessageOrGetter : failureMessageOrGetter(errorsText);
    if (opt.addErrorsText) {
        failureMessage += `: ${errorsText}`;
    }
    if (opt.addSchemaName && schemaName) {
        failureMessage += `\nSchemaName: "${schemaName}"`;
    }
    if (opt.addDataStr) {
        failureMessage += `\nData: ${ToJSON(data, undefined, 3)}`;
    }
    // we put this last, so that if message is shown in tooltip, we can see the more important data-str before line-count cutoff
    if (opt.addSchemaObject) {
        failureMessage += `\nSchemaObject: "${JSON.stringify(schemaObject, null, 2)}"`;
    }
    failureMessage += "\n";
    assertFunc(errorsText == null, failureMessage);
}
export function Schema_WithOptionalPropsAllowedNull(schema) {
    const result = Clone(schema);
    for (const { key: propName, value: propSchema } of (result.properties || {}).Pairs()) {
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
export function GetInvalidPropPaths(data, schemaObject) {
    const passed = ajv.validate(schemaObject, data);
    if (passed)
        return [];
    return ajv.errors.map(error => {
        let propPath = error.schemaPath
            .replace(/^\./, "") // remove starting dot
            .replace(/[.[\]]/g, "/") // replace instances of ".", "[", and "]" with "/"
            .replace(/\/+/g, "/"); // collapse each sequence of "/" into a single "/" (can be caused by: "arrayProp[0].prop" -> "arrayProp/0//prop")
        if (error.keyword == "additionalProperties") {
            propPath += `/${error.params["additionalProperty"]}`;
        }
        return { propPath, error };
    });
}
export function IsJSONSchemaScalar(typeStr) {
    return ["boolean", "integer", "number", "string"].includes(typeStr);
}
export function IsJSONSchemaOfTypeScalar(jsonSchema) {
    return ["boolean", "integer", "number", "string"].includes(jsonSchema === null || jsonSchema === void 0 ? void 0 : jsonSchema.type);
}
export function JSONSchemaScalarTypeToGraphQLScalarType(jsonSchemaScalarType) {
    if (jsonSchemaScalarType == "string")
        return "String";
    if (jsonSchemaScalarType == "integer")
        return "Int";
    if (jsonSchemaScalarType == "number")
        return "Float";
    if (jsonSchemaScalarType == "boolean")
        return "Boolean";
}
// hoisted schema definitions (eg. so other files, eg. KeyGenerator.ts, can be imported standalone)
// ==========
AddSchema("UUID", { type: "string", pattern: UUID_regex });

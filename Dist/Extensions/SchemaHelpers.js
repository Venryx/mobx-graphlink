var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import AJV from "ajv";
import AJVKeywords from "ajv-keywords";
import { Clone, ToJSON, IsString, Assert, E, CE } from "js-vextensions";
import { AssertV } from "../Accessors/Helpers.js";
//import {RemoveHelpers, WithoutHelpers} from "./DatabaseHelpers.js";
export const ajv = AJVKeywords(new AJV({ allErrors: true }));
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
export function Schema(schema) {
    schema = E({ additionalProperties: false }, schema);
    return schema;
}
export const schemaEntryJSONs = {};
export function AddSchema(...args) {
    return __awaiter(this, void 0, void 0, function* () {
        let name, schemaDeps, schemaOrGetter;
        if (args.length == 2)
            [name, schemaOrGetter] = args;
        else
            [name, schemaDeps, schemaOrGetter] = args;
        if (schemaDeps != null) {
            const schemaDep_waitPromises = schemaDeps.map(schemaName => WaitTillSchemaAdded(schemaName));
            // only await promises if there actually are schema-deps that need waiting for (avoid promises if possible, so AddSchema has chance to synchronously complete)
            if (schemaDep_waitPromises.find(a => a != null)) {
                yield Promise.all(schemaDep_waitPromises);
            }
        }
        let schema = schemaOrGetter instanceof Function ? schemaOrGetter() : schemaOrGetter;
        schema = Schema(schema);
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
    });
}
export function GetSchemaJSON(name) {
    return Clone(schemaEntryJSONs[name]);
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
export function WaitTillSchemaAdded(schemaName) {
    // if schema is already added, return right away (avoid promises if possible, so AddSchema has chance to synchronously complete)
    if (schemaEntryJSONs[schemaName] != null)
        return null;
    return new Promise((resolve, reject) => {
        // if schema is already added, run right away (avoid ajv.getSchema, since it errors on not-yet-resolvable refs)
        //if (ajv.getSchema(schemaName)) {
        if (schemaEntryJSONs[schemaName] != null) {
            resolve();
            return;
        }
        schemaAddListeners[schemaName] = (schemaAddListeners[schemaName] || []).concat(resolve);
    });
}
/* AJV.prototype.AddSchema = function(this: AJV_Extended, schema, name: string) {
    return `${this.errorsText()} (${ToJSON(this.errors)})`;
}; */
AJV.prototype.FullErrorsText = function () {
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
    if (data == null)
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
        this.addDataStr = true;
        this.allowOptionalPropsToBeNull = true;
        this.useAssertV = true;
    }
}
export function AssertValidate(schemaNameOrJSON, data, failureMessageOrGetter, opt = new AssertValidateOptions()) {
    const schemaName = IsString(schemaNameOrJSON) ? schemaNameOrJSON : null;
    const schemaObject = IsString(schemaNameOrJSON) ? GetSchemaJSON(schemaName) : schemaNameOrJSON;
    return AssertValidate_Full(schemaObject, schemaName, data, failureMessageOrGetter, opt);
}
export function AssertValidate_Full(schemaObject, schemaName, data, failureMessageOrGetter, opt) {
    var _a;
    opt = E(new AssertValidateOptions(), opt);
    AssertV(schemaObject, "schemaObject cannot be null.");
    schemaObject = Schema(schemaObject); // make sure we apply schema-object defaults
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
    /*if (opt.addSchemaObject) {
        failureMessage += `\nSchemaObject: "${schemaObject}"`;
    }*/
    if (opt.addDataStr) {
        failureMessage += `\nData: ${ToJSON(data, undefined, 3)}`;
    }
    failureMessage += "\n";
    if (opt.useAssertV) {
        AssertV(errorsText == null, failureMessage);
    }
    else {
        Assert(errorsText == null, failureMessage);
    }
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
        let propPath = error.dataPath
            .replace(/^\./, "") // remove starting dot
            .replace(/[.[\]]/g, "/") // replace instances of ".", "[", and "]" with "/"
            .replace(/\/+/g, "/"); // collapse each sequence of "/" into a single "/" (can be caused by: "arrayProp[0].prop" -> "arrayProp/0//prop")
        if (error.keyword == "additionalProperties") {
            propPath += `/${error.params["additionalProperty"]}`;
        }
        return { propPath, error };
    });
}

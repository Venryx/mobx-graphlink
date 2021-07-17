import { Clone } from "js-vextensions";
import { JSONStringify_NoQuotesForKeys } from "../Utils/General/General.js";
import { GetSchemaJSON } from "./JSONSchemaHelpers.js";
export function DeriveJSONSchema(typeName, modifiers) {
    const result = Clone(GetSchemaJSON(typeName));
    if (modifiers.includeOnly) {
        for (const key of Object.keys(result.properties)) {
            if (!modifiers.includeOnly.includes(key)) {
                delete result.properties[key];
            }
        }
        if (result.required)
            result.required = result.required.Including(...modifiers.includeOnly);
    }
    return result;
}
/*export function DeriveGQLSchema(typeName: string, modifiers: SchemaModifiers): string {
    return {};
}
export function DeriveJSONAndGQLSchema(typeName: string, modifiers: SchemaModifiers): CombinedFieldSchema {
    return {
        jsonSchema: DeriveJSONSchema(typeName, modifiers),
        gqlSchema: DeriveGQLSchema(typeName, modifiers),
    };
}*/
/** For use in graph-ql calls of queries and mutations. */
export function ConstructGQLArgsStr(argsObj, args_rawPrefixStr) {
    //const argsAsStr_json = Object.keys(argsObj).length ? JSON.stringify(argsObj) : "";
    const argsAsStr_json = Object.keys(argsObj).length ? JSONStringify_NoQuotesForKeys(argsObj) : "";
    const argsStr_parts = [
        args_rawPrefixStr,
        argsAsStr_json.slice(1, -1), // remove "{}"
    ].filter(a => a);
    return `(${argsStr_parts.join(", ")})`; // wrap with "()"
}
/** For use in mutation-resolver declarations/types. */
export function ConstructGQLArgTypesStr(argTypesObj, argTypes_rawPrefixStr) {
    return ConstructGQLArgsStr(argTypesObj, argTypes_rawPrefixStr).replace(/"/g, "");
}

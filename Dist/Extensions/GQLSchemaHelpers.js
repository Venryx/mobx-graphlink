import { getGraphqlSchemaFromJsonSchema } from "get-graphql-from-jsonschema";
import { Clone, GetTreeNodesInObjTree } from "js-vextensions";
import { JSONStringify_NoQuotesForKeys } from "../Utils/General/General.js";
import { GetSchemaJSON } from "./JSONSchemaHelpers.js";
export function GetGQLSchemaFromJSONSchema(opts) {
    const { rootName, schema, direction } = opts;
    const jsonSchema_final = Clone(opts.schema);
    // resolve {$ref: "XXX"} entries to the referenced schemas
    for (const node of GetTreeNodesInObjTree(jsonSchema_final, true)) {
        if (node.Value.$ref != null) {
            node.obj[node.prop] = GetSchemaJSON(node.Value.$ref);
        }
    }
    try {
        return getGraphqlSchemaFromJsonSchema({ rootName, schema: jsonSchema_final, direction });
    }
    catch (ex) {
        ex.message += `\n\n@schema:${JSON.stringify(jsonSchema_final, null, 2)}`;
        throw ex;
    }
}
/*export function JSONSchemaFieldInfoToGQLTypeName(fieldInfo: Object, required: boolean) {
    if (fieldInfo["type"] == "string") return "String";
    if (fieldInfo["type"] == "number") return "Float";
    if (fieldInfo["type"] == "boolean") return "Boolean";
}*/
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
    return argsStr_parts.join(", ");
}
/** For use in mutation-resolver declarations/types. */
export function ConstructGQLArgTypesStr(argTypesObj, argTypes_rawPrefixStr) {
    return ConstructGQLArgsStr(argTypesObj, argTypes_rawPrefixStr).replace(/"/g, "");
}

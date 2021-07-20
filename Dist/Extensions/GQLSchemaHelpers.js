import { Assert, CE, Clone } from "js-vextensions";
import { JSONStringify_NoQuotesForKeys } from "../Utils/General/General.js";
import { schemaEntryJSONs } from "./JSONSchemaHelpers.js";
import convert_ from "jsonschema2graphql";
import { printSchema } from "graphql";
//import {getGraphqlSchemaFromJsonSchema} from "get-graphql-from-jsonschema";
const convert = convert_["default"];
export function FinalizeSchemaForConversionToGraphQL(schema) {
    var _a;
    // make sure "type" is specified
    if (schema.type == null) {
        //const needsType = (schema.oneOf ?? schema.allOf ?? schema.anyOf) == null;
        const needsType = schema.$ref == null && schema.oneOf == null;
        if (needsType) {
            if (schema.$ref == "UUID")
                schema.type = "string";
            else
                schema.type = "object";
        }
        // if looks like enum, supply "type:string" on each entry
        /*if (schema.oneOf && typeof schema.oneOf[0]?.["const"] == "string") {
            for (const val of schema.oneOf) {
                val["type"] = "string";
            }
        }*/
    }
    // make sure type does not contain "null" as an option
    if (schema.type instanceof Array && schema.type.includes("null")) {
        schema.type = CE(schema.type).Except("null");
    }
    // if type:array, make sure "items" is specified
    if (schema.type == "array" && schema.items == null) {
        schema.items = FinalizeSchemaForConversionToGraphQL({});
    }
    // if type:object, make sure "properties" is specified
    if (schema.type == "object" && schema.properties == null) {
        schema.properties = {};
    }
    // apply the same fixes for sub-schemas
    for (const [propName, propSchema] of Object.entries((_a = schema.properties) !== null && _a !== void 0 ? _a : {})) {
        if (typeof propSchema == "object") {
            FinalizeSchemaForConversionToGraphQL(propSchema);
        }
    }
    return schema;
}
export class TypeDef {
}
export class GraphQLSchemaInfo {
}
export function GetGQLSchemaInfoFromJSONSchema(opts) {
    const { rootName, jsonSchema, direction } = opts;
    let placeholdersForExistingSchemas = [...schemaEntryJSONs.entries()].map(([name, oldSchema]) => {
        return { $id: name, type: "object", _isPlaceholder: true };
    });
    // if there's an existing schema with exactly the name of one we're passing in, don't include that existing-schema as a placeholder/"dependency"
    placeholdersForExistingSchemas = placeholdersForExistingSchemas.filter(a => NormalizeTypeName(a.$id) != NormalizeTypeName(opts.rootName));
    const jsonSchema_final = Clone(opts.jsonSchema);
    jsonSchema_final.$id = opts.rootName;
    FinalizeSchemaForConversionToGraphQL(jsonSchema_final);
    // resolve {$ref: "XXX"} entries to the referenced schemas
    /*for (const node of GetTreeNodesInObjTree(jsonSchema_final, true)) {
        if (node.Value.$ref != null) {
            node.obj[node.prop] = GetSchemaJSON(node.Value.$ref);
        }
    }*/
    function NormalizeTypeName(typeName) {
        return typeName.toLowerCase().replace(/[^a-z]/g, ""); // to match with "jsonschema2graphql"
    }
    try {
        //return getGraphqlSchemaFromJsonSchema({rootName, schema: jsonSchema_final, direction});
        const gqlSchema = convert({ jsonSchema: [...placeholdersForExistingSchemas, jsonSchema_final] });
        const gqlSchemaStr = printSchema(gqlSchema);
        const typeDefs = ExtractTypeDefs(gqlSchemaStr);
        const typeDefs_indexForLastDep = typeDefs.findIndex(a => NormalizeTypeName(a.name) == NormalizeTypeName(CE(placeholdersForExistingSchemas).Last().$id));
        const typeDefs_new = typeDefs_indexForLastDep != -1 ? typeDefs.slice(typeDefs_indexForLastDep + 1) : [];
        //console.log("Test2:", NormalizeTypeName(CE(placeholdersForExistingSchemas).Last().$id), typeDefs.map(a=>NormalizeTypeName(a.name)));
        Assert(typeDefs_new.length, `Could not find/generate type-def for "${opts.rootName}". @typeDefs:${"" /*JSON.stringify(typeDefs, null, 2)*/} @jsonSchema:${JSON.stringify(jsonSchema, null, 2)}`);
        //const gqlSchemaStr_newPart = gqlSchemaStr.slice(typeDefs_new[0].strIndexInSchemaStr);
        //console.log("TypeDefs_New:", typeDefs_new);
        for (const typeDef of typeDefs_new) {
            if (typeDef.type == "type" && direction == "input") {
                typeDef.type = "input";
                Assert([...typeDef.str.matchAll(/type /g)].length == 1, `More than one type definition in entry. Str:${typeDef.str}`);
                //typeDef.str = typeDef.str.replace(/type /g, "input ");
                typeDef.str = typeDef.str.replace("type ", "input ");
            }
        }
        const gqlSchemaStr_newPart_final = typeDefs_new.map(a => a.str).join();
        return {
            //typeName: opts.rootName,
            typeName: typeDefs_new[0].name,
            //schema: gqlSchema,
            //schemaAsStr: printSchema(gqlSchema),
            //schemaAsStr: gqlSchemaStr_newPart,
            schemaAsStr: gqlSchemaStr_newPart_final,
            typeDefs: typeDefs_new,
        };
    }
    catch (ex) {
        ex.message += `\n\n@schema:${JSON.stringify(jsonSchema_final, null, 2)}`;
        throw ex;
    }
}
function ExtractTypeDefs(schemaStr, trimStrings = true) {
    /*const matches = CE(schemaStr).Matches(/(^|\n)(type|input|union) (.+?)( |$)/);
    Assert(matches.length, `Could not find any type-defs in schema-str: ${schemaStr}`);

    const typeDefs = [] as {type: "type" | "input" | "union", name: string, str: string}[];
    for (const [matchIndex, match] of matches.entries()) {
        const typeStr = schemaStr.slice(match.index, matches[matchIndex + 1]?.index ?? schemaStr.length);
        typeDefs.push({type: match[2] as any, name: match[3], str: typeStr});
    }*/
    var _a, _b, _c, _d;
    const lineMatches = CE(schemaStr).Matches(/^( *).+$/m);
    const rootDefStartPoints = [];
    for (const [index, lineMatch] of lineMatches.entries()) {
        if (lineMatch[0].trim().length == 0)
            continue; // ignore empty lines
        const prevLineMatch_indent = (_b = (_a = lineMatches[index - 1]) === null || _a === void 0 ? void 0 : _a[1].length) !== null && _b !== void 0 ? _b : 0;
        const lineMatch_indent = (_c = lineMatch[1].length) !== null && _c !== void 0 ? _c : 0;
        //const nextLineMatch_indent = lineMatches[index + 1]?.[1].length ?? 0;
        if (prevLineMatch_indent == 0 && lineMatch_indent == 0) {
            rootDefStartPoints.push(lineMatch.index);
        }
    }
    const typeDefs = [];
    for (const [i, startPoint] of rootDefStartPoints.entries()) {
        const nextStartPoint = (_d = rootDefStartPoints[i + 1]) !== null && _d !== void 0 ? _d : schemaStr.length;
        const typeStr = schemaStr.slice(startPoint, nextStartPoint);
        const match = typeStr.match(/(^|\n)(type|input|union) (.+?)( |$)/);
        if (match == null) {
            console.warn("Could not understand type-str:", typeStr);
            continue;
        }
        typeDefs.push({ type: match[2], name: match[3], str: trimStrings ? typeStr.trim() : typeStr, strIndexInSchemaStr: startPoint });
    }
    return typeDefs;
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

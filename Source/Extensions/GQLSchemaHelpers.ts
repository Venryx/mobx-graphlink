import {Assert, CE, Clone, GetTreeNodesInObjTree, FancyFormat, TreeNode} from "js-vextensions";
import {JSONSchema7, JSONSchema7Definition} from "json-schema";
import {JSONStringify_NoQuotesForKeys} from "../Utils/General/General.js";
import {GetSchemaJSON, IsJSONSchemaOfTypeScalar, JSONSchemaScalarTypeToGraphQLScalarType, schemaEntryJSONs} from "./JSONSchemaHelpers.js";
import {getGraphqlSchemaFromJsonSchema} from "@vforks/get-graphql-from-jsonschema";
import {CommandsPlugin_opts, CreateCommandPlugin_Options} from "../Server/CommandsPlugin.js";
//const convert = convert_["default"] as typeof convert_;

export function FinalizeSchemaForConversionToGraphQL(schema: JSONSchema7, refPath: string[] = []): void {
	// make sure "type" is specified
	if (schema.type == null) {
		const needsType = (schema.$ref ?? schema.enum ?? schema.anyOf ?? schema.oneOf) == null;
		if (needsType) {
			if (schema.pattern != null) schema.type = "string";
			else if (schema.items != null) schema.type = "array";
			else if (schema.properties != null) schema.type = "object";
			//else Assert(false, FancyFormat({}, "Could not determine type of schema:", schema));
			else schema.type = "object"; // just assume type:object otherwise
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
		schema.type = CE(schema.type).Exclude("null");
	}

	// if type:array, make sure "items" is specified
	if (schema.type == "array" && schema.items == null) {
		schema.items = {};
		FinalizeSchemaForConversionToGraphQL(schema.items, refPath);
	}

	// if type:object, make sure "properties" is specified
	if (schema.type == "object" && schema.properties == null) {
		schema.properties = {};
	}

	// apply the same fixes for property sub-schemas
	for (const [propName, propSchema] of Object.entries(schema.properties ?? {})) {
		if (typeof propSchema == "object") {
			FinalizeSchemaForConversionToGraphQL(propSchema, refPath);
		}
	}
}

export class TypeDef {
	type: "type" | "input" | "union" | "rootTypeExtension"; // rootTypeExtension is for, eg. "extend type Mutation { ... }" entries
	name: string;
	str: string;
	strIndexInSchemaStr?: number;
}
export class GraphQLSchemaInfo {
	constructor(data?: Partial<GraphQLSchemaInfo>) {
		Object.assign(this, data);
	}
	typeName: string; // the name of the "main graphql type" generated for the given json-schema
	typeDefs: TypeDef[];
	//schemaAsStr: string;
	get TypeDefs_AsSchemaStr() {
		return this.typeDefs.map(a=>a.str).join("\n\n");
	}
}

export function NormalizeGQLTypeName(typeName: string) {
	//return typeName.toLowerCase().replace(/[^a-z]/g, "");
	// normalize types from "get-graphql-from-jsonschema": MapNodeT0TypeT0 -> MapNode.Type, ChangeClaimType_Payload.NewType -> ChangeClaimType_Payload.newType
	if (typeName.includes("T0")) {
		return typeName
			.replace(/T0/g, ".")
			.replace(/\.[A-Z]/g, str=>str.toLowerCase())
			.replace(/\.$/, "");
	}
	// normalize directly-passed class/type names: MapNode_Partial -> MapNode_Partial (no change needed)
	return typeName;
}

export function GetGQLSchemaInfoFromJSONSchema(opts: {rootName: string, jsonSchema: JSONSchema7, direction?: "input" | "output"}): GraphQLSchemaInfo {
	const {rootName, jsonSchema, direction} = opts;

	// only used by "graphql2jsonschema"
	/*let placeholdersForExistingSchemas = [...schemaEntryJSONs.entries()].map(([name, oldSchema])=>{
		return {$id: name, type: "object", _isPlaceholder: true};
	});
	// if there's an existing schema with exactly the name of one we're passing in, don't include that existing-schema as a placeholder/"dependency"
	placeholdersForExistingSchemas = placeholdersForExistingSchemas.filter(a=>NormalizeGQLTypeName(a.$id) != NormalizeGQLTypeName(opts.rootName));*/
	
	let jsonSchema_final = Clone(jsonSchema);
	//jsonSchema_final.$id = opts.rootName; // only used by "graphql2jsonschema"
	FinalizeSchemaForConversionToGraphQL(jsonSchema_final);

	try {
		const gqlSchemaInfo = getGraphqlSchemaFromJsonSchema({
			rootName,
			schema: jsonSchema_final,
			direction,
			refToTypeName: refName=>{
				const schema = GetSchemaJSON(refName);
				if (IsJSONSchemaOfTypeScalar(schema)) {
					return JSONSchemaScalarTypeToGraphQLScalarType(schema.type as string)!;
				}
				return `${refName}T0`;
			},
		});
		const gqlSchemaStr_temp = gqlSchemaInfo.typeDefinitions.join("\n\n");
		const typeDefs = ExtractTypeDefs(gqlSchemaStr_temp, true, jsonSchema_final);
		/*const typeDefs_indexForLastDep = typeDefs.findIndex(a=>NormalizeTypeName(a.name) == NormalizeTypeName(CE(placeholdersForExistingSchemas).Last().$id));
		const typeDefs_new = typeDefs_indexForLastDep != -1 ? typeDefs.slice(typeDefs_indexForLastDep + 1) : [];*/
		Assert(typeDefs.length, `Could not find/generate type-def for "${rootName}". @typeDefs:${""/*JSON.stringify(typeDefs, null, 2)*/}`);
		//console.log("TypeDefs_New:", typeDefs_new);

		if (CommandsPlugin_opts?.logTypeDefs_detailed?.includes(rootName)) {
			console.log("Type-definition details info:\n----------\n",
				"schema:", jsonSchema_final,
				"gqlSchemaStr:", gqlSchemaStr_temp,
			);
		}

		return new GraphQLSchemaInfo({
			//typeName: opts.rootName,
			typeName: typeDefs[0].name,
			//schema: gqlSchema,
			//schemaAsStr: printSchema(gqlSchema),
			//schemaAsStr: gqlSchemaStr_newPart,
			//schemaAsStr: gqlSchemaStr,
			typeDefs: typeDefs,
		});
	} catch (ex) {
		ex.message += `\n\n@schema:${JSON.stringify(jsonSchema_final, null, 2)}`;
		throw ex;
	}
}
function ExtractTypeDefs(schemaStr: string, trimStrings = true, sourceJSONSchema?: JSONSchema7) {
	/*const matches = CE(schemaStr).Matches(/(^|\n)(type|input|union) (.+?)( |$)/);
	Assert(matches.length, `Could not find any type-defs in schema-str: ${schemaStr}`);

	const typeDefs = [] as {type: "type" | "input" | "union", name: string, str: string}[];
	for (const [matchIndex, match] of matches.entries()) {
		const typeStr = schemaStr.slice(match.index, matches[matchIndex + 1]?.index ?? schemaStr.length);
		typeDefs.push({type: match[2] as any, name: match[3], str: typeStr});
	}*/

	const lineMatches = CE(schemaStr).Matches(/^( *).+$/m);
	const rootDefStartPoints = [] as number[];
	for (const [index, lineMatch] of lineMatches.entries()) {
		if (lineMatch[0].trim().length == 0) continue; // ignore empty lines
		const prevLineMatch_indent = lineMatches[index - 1]?.[1].length ?? 0;
		const lineMatch_indent = lineMatch[1].length ?? 0;
		//const nextLineMatch_indent = lineMatches[index + 1]?.[1].length ?? 0;
		if (prevLineMatch_indent == 0 && lineMatch_indent == 0) {
			rootDefStartPoints.push(lineMatch.index!);
		}
	}

	const typeDefs = [] as TypeDef[];
	for (const [i, startPoint] of rootDefStartPoints.entries()) {
		const nextStartPoint = rootDefStartPoints[i + 1] ?? schemaStr.length;
		const typeStr = schemaStr.slice(startPoint, nextStartPoint);
		const match = typeStr.match(/(^|\n)(type|input|enum|union) (.+?)(\n| {\n|$)/);
		Assert(match != null, FancyFormat({}, "Could not understand type-str (to retrieve type-name):", typeStr/*, "@sourceJSONSchema:", sourceJSONSchema*/));
		/*if (match == null) {
			console.warn("Could not understand type-str:", typeStr, "@sourceJSONSchema:", sourceJSONSchema);
			continue;
		}*/
		typeDefs.push({type: match[2] as any, name: match[3], str: trimStrings ? typeStr.trim() : typeStr, strIndexInSchemaStr: startPoint});
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
export function ConstructGQLArgsStr(argsObj: Object, args_rawPrefixStr?: string|null) {
	//const argsAsStr_json = Object.keys(argsObj).length ? JSON.stringify(argsObj) : "";
	const argsAsStr_json = Object.keys(argsObj).length ? JSONStringify_NoQuotesForKeys(argsObj) : "";
	const argsStr_parts = [
		args_rawPrefixStr,
		argsAsStr_json.slice(1, -1), // remove "{}"
	].filter(a=>a);
	return argsStr_parts.join(", ");
}
/** For use in mutation-resolver declarations/types. */
export function ConstructGQLArgTypesStr(argTypesObj: Object, argTypes_rawPrefixStr?: string|null) {
	return ConstructGQLArgsStr(argTypesObj, argTypes_rawPrefixStr).replace(/"/g, "");
}
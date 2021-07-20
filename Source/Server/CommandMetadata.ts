import {Assert, CE, SleepAsync, string, WaitXThenRun} from "js-vextensions";
import {Command} from "./Command.js";
import {JSONSchema7, JSONSchema7Definition, JSONSchema7Type} from "json-schema";
import {GetGQLSchemaInfoFromJSONSchema, GraphQLSchemaInfo, NormalizeGQLTypeName} from "../Extensions/GQLSchemaHelpers.js";
import {GetSchemaJSON, IsJSONSchemaOfTypeScalar, IsJSONSchemaScalar, JSONSchemaScalarTypeToGraphQLScalarType, schemaEntryJSONs} from "../Extensions/JSONSchemaHelpers.js";

export function CommandMeta(opts: {
	payloadSchema: ()=>JSONSchema7,
	returnSchema?: ()=>JSONSchema7,
	defaultPayload?: any,
}) {
	return (constructor: typeof Command)=>{
		Assert(!commandClasses.includes(constructor));
		commandClasses.push(constructor);
		Assert(!commandClassMetadata.has(constructor.name));
		const metadata = new CommandClassMetadata({
			commandClass: constructor,
			payloadSchemaGetter: opts.payloadSchema,
			returnSchemaGetter: opts.returnSchema,
			defaultPayload: opts.defaultPayload,
		});
		commandClassMetadata.set(constructor.name, metadata);

		// wait a moment before calculating derivatives (we need to make sure all schema-deps are added first)
		WaitXThenRun(0, ()=>metadata.CalculateDerivatives());
		/*(async()=>{
			// wait a few ticks (so all schemas finish getting added, even those depending-on/waiting-for others)
			for (let i = 0; i < 3; i++) {
				await SleepAsync(100);
			}
			//await SleepAsync(0);
			//console.log("Test1:", schemaEntryJSONs.get("MapNode_Partial"));
			if (!schemaEntryJSONs.get("MapNode_Partial")) throw "test1";
			if (!schemaEntryJSONs.get("MapNodeView")) throw "test2";
			metadata.CalculateDerivatives();
		})();*/
	};
}

export const commandClasses = new Array<typeof Command>();
export function GetCommandClass(name: string) {
	return commandClasses.find(a=>a.name == name);
}
export const commandClassMetadata = new Map<string, CommandClassMetadata>();
export function GetCommandClassMetadata(name: string): CommandClassMetadata {
	Assert(commandClassMetadata.has(name), `Cannot find command-class-metadata for: ${name}`);
	return commandClassMetadata.get(name)!;
}
export function GetCommandClassMetadatas() {
	return Array.from(commandClassMetadata.values());
}

export class CommandClassMetadata {
	constructor(data?: Partial<CommandClassMetadata>) {
		Object.assign(this, data);
		//this.CalculateDerivatives();
	}

	commandClass: typeof Command;
	payloadSchemaGetter: (()=>JSONSchema7)|null|undefined; // set by @CommandMeta
	returnSchemaGetter: (()=>JSONSchema7)|null|undefined; // set by @CommandMeta
	defaultPayload = {};

	// derivatives
	payloadSchema: JSONSchema7;
	returnSchema: JSONSchema7;
	payload_graphqlInfo: GraphQLSchemaInfo;
	return_graphqlInfo: GraphQLSchemaInfo;

	CalculateDerivatives() {
		this.payloadSchema = this.payloadSchemaGetter?.() ?? {};
		this.returnSchema = this.returnSchemaGetter?.() ?? {};
		//console.log("CommandClass:", this.commandClass.name, "@payloadInfo:", JSON.stringify(this.payloadSchema, null, 2), "@returnInfo:", JSON.stringify(this.returnSchema, null, 2));

		/*const argsObj = {};
		for (const [propName, propSchema] of Object.entries(payloadInfo.properties ?? {}) as [string, Object][]) {
			const required = payloadInfo.required?.includes(propName) ?? false;
			let gqlType = JSONSchemaFieldInfoToGQLTypeName(propSchema, required);
			if (gqlType == null) {
				if ()
			}
			argsObj[propName] = 
		}*/

		this.payload_graphqlInfo = GetGQLSchemaInfoFromJSONSchema({
			rootName: `${this.commandClass.name}_Payload`,
			jsonSchema: this.payloadSchema as any,
			direction: "input",
		});
		this.return_graphqlInfo = GetGQLSchemaInfoFromJSONSchema({
			rootName: `${this.commandClass.name}_ReturnData`,
			jsonSchema: this.returnSchema as any,
		});
	}

	// eslint-disable-next-line no-loop-func
	FindGQLTypeName(opts: {group: "payload" | "return", typeName?: string, propName?: string, propSchema?: JSONSchema7}) {
		if (opts.propName) {
			if (opts.propSchema?.$ref != null) {
				const schemaName = opts.propSchema.$ref;
				const schema = GetSchemaJSON(schemaName);
				if (IsJSONSchemaOfTypeScalar(schema)) {
					// graphql types can't represent scalars (eg. with constraints) as separate types; so replace a ref to such a type with its scalar type
					return JSONSchemaScalarTypeToGraphQLScalarType(schema.type as string)!;
				}
				return `${schemaName}T0`; // to match with "get-graphql-from-jsonschema" output
			}

			const groupInfo = opts.group == "payload" ? this.payloadSchema : this.returnSchema;
			const fieldJSONSchema = groupInfo.properties?.[opts.propName] as JSONSchema7;
			if (fieldJSONSchema.type) {
				let type_normalized: string|undefined;
				if (typeof fieldJSONSchema.type == "string") type_normalized = fieldJSONSchema.type;
				else if (fieldJSONSchema.type instanceof Array) {
					const nonNullTypes = fieldJSONSchema.type.filter(a=>a != "null");
					if (nonNullTypes.length == 1) type_normalized = nonNullTypes[0];
				}
				if (type_normalized && IsJSONSchemaScalar(type_normalized)) {
					return JSONSchemaScalarTypeToGraphQLScalarType(type_normalized)!;
				}
			}
		}

		const typeName = opts.typeName
			? opts.typeName // eg. UpdateTerm_ReturnData
			: `${this.commandClass.name}_Payload.${opts.propName}`; // eg. UpdateTerm_Payload.id
		const typeName_normalized = NormalizeGQLTypeName(typeName);

		const schemaInfo = opts.group == "payload" ? this.payload_graphqlInfo : this.return_graphqlInfo;
		const typeDefNames_normalized = schemaInfo.typeDefs.map(typeDef=>{
			//return typeDef.name?.replace(/(T0)+/g, ".").toLowerCase().slice(0, -1); // UpdateTermT0UpdatesT0 -> updateterm.updates
			//return typeDef.name?.toLowerCase(); // UpdateTermUpdates -> updatetermupdates
			return NormalizeGQLTypeName(typeDef.name);
		});

		const result = schemaInfo.typeDefs[typeDefNames_normalized.findIndex(a=>a == typeName_normalized)];
		Assert(result, `Could not find type-def for type/prop name "${opts.typeName ?? opts.propName}".${""
			}\n@typeName_normalized:${typeName_normalized
			}\n@typeDefNames_normalized:${typeDefNames_normalized.join(",")
			}\n@typeDefStrings:${schemaInfo.typeDefs.map(a=>a.str)}`);
		return result.name;
	}

	GetArgTypes() {
		const meta = GetCommandClassMetadata(this.commandClass.name);
		const argGQLTypeNames = [] as {name: string, type: string}[];
		for (const [propName, propSchema] of Object.entries(meta.payloadSchema.properties ?? {})) {
			argGQLTypeNames.push({name: propName, type: this.FindGQLTypeName({group: "payload", propName, propSchema: propSchema as JSONSchema7})});
		}
		return argGQLTypeNames;
	}
	// for mutation graph-ql declaration/type
	Args_GetArgDefsStr() {
		return this.GetArgTypes().map(a=>`${a.name}: ${a.type}`).join(", ");
	}
	// for mutation calls
	Args_GetVarDefsStr() {
		return this.GetArgTypes().map(a=>`$${a.name}: ${a.type}`).join(", ");
	}
	/*GetArgNames() {
		const meta = GetCommandClassMetadata(this.commandClass.name);
		return Object.keys(meta.payloadInfo.properties ?? {});
	}*/
	Args_GetArgsUsageStr() {
		return this.GetArgTypes().map(a=>`${a.name}: $${a.name}`).join(", ");
	}

	Return_GetFieldTypes() {
		const meta = GetCommandClassMetadata(this.commandClass.name);
		const fieldTypes = [] as {name: string, type: string}[];
		for (const [fieldName, fieldSchema] of Object.entries(meta.returnSchema.properties ?? {})) {
			fieldTypes.push({name: fieldName, type: this.FindGQLTypeName({group: "return", propName: fieldName, propSchema: fieldSchema as JSONSchema7})});
		}
		return fieldTypes;
	}
	Return_GetFieldsStr() {
		const return_fieldTypes = this.Return_GetFieldTypes();
		if (return_fieldTypes.length == 0) return "_"; // results in "{_}", matching the placeholder given in the mutation-declaration
		return return_fieldTypes.map(a=>a.name).join("\n");
	}
}

/*export interface CombinedFieldSchema {
	jsonSchema: Object;
	gqlSchema: string;
}
export interface CombinedObjectSchema {
	[key: string]: CombinedFieldSchema;
	required: string[];
}*/
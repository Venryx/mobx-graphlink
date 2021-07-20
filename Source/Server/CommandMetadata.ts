import {Assert, CE, SleepAsync, string, WaitXThenRun} from "js-vextensions";
import {Command} from "./Command.js";
import {JSONSchema7, JSONSchema7Definition, JSONSchema7Type} from "json-schema";
import {getGraphqlSchemaFromJsonSchema} from "get-graphql-from-jsonschema";
import {GetGQLSchemaInfoFromJSONSchema, GraphQLSchemaInfo} from "../Extensions/GQLSchemaHelpers.js";
import {schemaEntryJSONs} from "../Extensions/JSONSchemaHelpers.js";

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
			// wait a few ticks (so all schemas finish getting added)
			/*for (let i = 0; i < 3; i++) {
				await SleepAsync(100);
			}*#/
			await SleepAsync(0);
			//console.log("Test1:", schemaEntryJSONs.get("MapNode_Partial"));
			if (!schemaEntryJSONs.get("MapNode_Partial")) throw "test1";
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
			rootName: this.commandClass.name,
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
			if (opts.propSchema?.$ref != null) return opts.propSchema.$ref;

			const groupInfo = opts.group == "payload" ? this.payloadSchema : this.returnSchema;
			const fieldJSONSchema = groupInfo.properties?.[opts.propName] as JSONSchema7;
			
			let type_normalized = fieldJSONSchema?.type;
			if (type_normalized instanceof Array) {
				const nonNullTypes = type_normalized.filter(a=>a != "null");
				if (nonNullTypes.length == 1) type_normalized = nonNullTypes[0];
			}
			if (type_normalized == "string") return "String";
			if (type_normalized == "number") return "Float";
			if (type_normalized == "boolean") return "Boolean";
		}

		function NormalizeTypeName(typeName: string) {
			return typeName.toLowerCase().replace(/[^a-z]/g, ""); // to match with "jsonschema2graphql"
		}

		const typeName = opts.typeName
			? opts.typeName // eg. UpdateTerm_ReturnData
			: `${this.commandClass.name}.${opts.propName}`; // eg. UpdateTerm.id
		const typeName_normalized = NormalizeTypeName(typeName);

		const schemaInfo = opts.group == "payload" ? this.payload_graphqlInfo : this.return_graphqlInfo;
		const typeDefNames_normalized = schemaInfo.typeDefs.map(typeDef=>{
			//return typeDef.name?.replace(/(T0)+/g, ".").toLowerCase().slice(0, -1); // UpdateTermT0UpdatesT0 -> updateterm.updates
			//return typeDef.name?.toLowerCase(); // UpdateTermUpdates -> updatetermupdates
			return NormalizeTypeName(typeDef.name);
		});

		const result = schemaInfo.typeDefs[typeDefNames_normalized.findIndex(a=>a == typeName_normalized)];
		Assert(result, `Could not find type-def for type/prop name "${opts.typeName ?? opts.propName}".${""
			}\n@typeName_normalized:${typeName_normalized
			}\n@typeDefNames_normalized:${typeDefNames_normalized.join(",")
			}\n@lastTypeDef_str:${schemaInfo.typeDefs.slice(-1)[0].str}`);
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
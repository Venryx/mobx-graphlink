import {Assert, CE, ModifyString, SleepAsync, string, WaitXThenRun} from "js-vextensions";
import {JSONSchema7, JSONSchema7Definition, JSONSchema7Type} from "json-schema";
import {Command, DBHelper} from "./Command.js";
import {GetGQLSchemaInfoFromJSONSchema, GraphQLSchemaInfo, NormalizeGQLTypeName} from "../Extensions/GQLSchemaHelpers.js";
import {GetSchemaJSON, IsJSONSchemaOfTypeScalar, IsJSONSchemaScalar, JSONSchemaScalarTypeToGraphQLScalarType, schemaEntryJSONs} from "../Extensions/JSONSchemaHelpers.js";

export function CommandMeta(opts: {
	inputSchema: ()=>JSONSchema7,
	responseSchema?: ()=>JSONSchema7,
	defaultInput?: any,
	//extraDBUpdates?: (helper: DBHelper)=>any,
	exposeToGraphQL?: boolean,
}) {
	return (constructor: typeof Command)=>{
		Assert(!commandClasses.includes(constructor), `This exact command-class was already registered. @name:${constructor.name}`);
		commandClasses.push(constructor);
		Assert(!commandClassMetadata.has(constructor.name), `A command-class was already registered with this name (${constructor.name}), but a different instance.`);
		const metadata = new CommandClassMetadata({
			commandClass: constructor,
			inputSchemaGetter: opts.inputSchema,
			responseSchemaGetter: opts.responseSchema,
			defaultInput: opts.defaultInput,
			//extraDBUpdates: opts.extraDBUpdates,
			exposeToGraphQL: opts.exposeToGraphQL,
		});
		commandClassMetadata.set(constructor.name, metadata);

		// wait a moment before calculating derivatives (we need to make sure all schema-deps are added first)
		WaitXThenRun(0, ()=>metadata.CalculateDerivatives());
		/*(async()=>{
			// wait a few ticks, so all schemas finish getting added, even those depending-on/waiting-for others
			// (the promise mechanism in AddSchema can itself take a couple ticks, due to its having multiple async-funcs/await-calls)
			for (let i = 0; i < 3; i++) {
				await SleepAsync(100);
				//await SleepAsync(0);
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
		Object.assign(this, CE(data ?? {}).OmitUndefined());
		//this.CalculateDerivatives();
	}

	commandClass: typeof Command;
	inputSchemaGetter: (()=>JSONSchema7)|null|undefined; // set by @CommandMeta
	responseSchemaGetter: (()=>JSONSchema7)|null|undefined; // set by @CommandMeta
	defaultInput = {};
	//extraDBUpdates?: (helper: DBHelper)=>any;
	exposeToGraphQL = true;

	// derivatives
	inputSchema: JSONSchema7;
	responseSchema: JSONSchema7;
	/*input_graphqlInfo: GraphQLSchemaInfo;
	response_graphqlInfo: GraphQLSchemaInfo;*/

	CalculateDerivatives() {
		this.inputSchema = this.inputSchemaGetter?.() ?? {};
		this.responseSchema = this.responseSchemaGetter?.() ?? {};
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

		/*this.input_graphqlInfo = GetGQLSchemaInfoFromJSONSchema({
			rootName: `${this.commandClass.name}Input`,
			jsonSchema: this.inputSchema as any,
			direction: "input",
		});
		this.response_graphqlInfo = GetGQLSchemaInfoFromJSONSchema({
			rootName: `${this.commandClass.name}Response`,
			jsonSchema: this.responseSchema as any,
		});*/
	}

	// eslint-disable-next-line no-loop-func
	FindGQLTypeName(opts: {group: "input" | "response", typeName?: string, propName?: string, propSchema?: JSONSchema7}) {
		if (opts.propName) {
			if (opts.propSchema) {
				const result = this.FindGQLTypeNameForFieldSchema(opts.group, opts.propSchema);
				if (result != null) return result;
			}
			const groupInfo = opts.group == "input" ? this.inputSchema : this.responseSchema;
			const fieldSchema = groupInfo.properties?.[opts.propName] as JSONSchema7;
			if (fieldSchema) {
				const result = this.FindGQLTypeNameForFieldSchema(opts.group, fieldSchema);
				if (result != null) return result;
			}
		}

		let typeName: string;
		if (opts.typeName) {
			typeName = opts.typeName; // eg. UpdateTermResponse
		} else {
			Assert(opts.group == "input", "Cannot calculate the gql type-name, in groups other than \"input\".");
			typeName = `${this.commandClass.name}${ModifyString(opts.group, m=>[m.startLower_to_upper])}.${opts.propName}`; // eg. UpdateTermInput.id
		}
		const typeName_normalized = NormalizeGQLTypeName(typeName);

		/*const schemaInfo = opts.group == "input" ? this.input_graphqlInfo : this.response_graphqlInfo;
		const typeDefNames_normalized = schemaInfo.typeDefs.map(typeDef=>{
			//return typeDef.name?.replace(/(T0)+/g, ".").toLowerCase().slice(0, -1); // UpdateTermT0UpdatesT0 -> updateterm.updates
			//return typeDef.name?.toLowerCase(); // UpdateTermUpdates -> updatetermupdates
			return NormalizeGQLTypeName(typeDef.name);
		});

		const result = schemaInfo.typeDefs[typeDefNames_normalized.findIndex(a=>a == typeName_normalized)];
		Assert(result, `Could not find type-def for type/prop name "${opts.typeName ?? opts.propName}". Did you forget to add a schema dependency?${""
			}\n\t@typeName_normalized:${typeName_normalized
			}\n\t@typeDefNames_normalized:${typeDefNames_normalized.join(",")
			}\n\t@typeDefStrings:${schemaInfo.typeDefs.map(a=>a.str)
			}\n\t@group:${opts.group}`);
		return result.name;*/

		return typeName_normalized;
	}
	FindGQLTypeNameForFieldSchema(group: "input" | "response", fieldSchema: JSONSchema7) {
		if (fieldSchema.$ref != null) {
			const schemaName = fieldSchema.$ref;
			const schema = GetSchemaJSON(schemaName);
			if (IsJSONSchemaOfTypeScalar(schema)) {
				// graphql types can't represent scalars (eg. with constraints) as separate types; so replace a ref to such a type with its scalar type
				return JSONSchemaScalarTypeToGraphQLScalarType(schema.type as string)!;
			}
			return `${schemaName}T0`; // to match with "get-graphql-from-jsonschema" output
		}
		if (fieldSchema.type) {
			let type_normalized: string|undefined;
			if (typeof fieldSchema.type == "string") type_normalized = fieldSchema.type;
			else if (fieldSchema.type instanceof Array) {
				const nonNullTypes = fieldSchema.type.filter(a=>a != "null");
				if (nonNullTypes.length == 1) type_normalized = nonNullTypes[0];
			}
			if (type_normalized && IsJSONSchemaScalar(type_normalized)) {
				return JSONSchemaScalarTypeToGraphQLScalarType(type_normalized)!;
			}
		}

		// if we're dealing with an array, recall this function with the schema for the items
		if (fieldSchema.items != null && typeof fieldSchema.items == "object") {
			const result = this.FindGQLTypeNameForFieldSchema(group, fieldSchema.items as JSONSchema7);
			if (result) return `[${result}]`;
		}
	}

	GetArgTypes() {
		const meta = GetCommandClassMetadata(this.commandClass.name);
		const argGQLTypeNames = [] as {name: string, type: string}[];
		for (const [propName, propSchema] of Object.entries(meta.inputSchema.properties ?? {})) {
			argGQLTypeNames.push({name: propName, type: this.FindGQLTypeName({group: "input", propName, propSchema: propSchema as JSONSchema7})});
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

	// new generation
	// for mutation calls
	Args_GetVarDefsStr_New() {
		return `$input: ${this.commandClass.name}Input`;
	}
	Args_GetArgsUsageStr_New() {
		return `input: $input`;
	}

	Response_GetFieldTypes() {
		const meta = GetCommandClassMetadata(this.commandClass.name);
		const fieldTypes = [] as {name: string, type: string}[];
		for (const [fieldName, fieldSchema] of Object.entries(meta.responseSchema.properties ?? {})) {
			fieldTypes.push({name: fieldName, type: this.FindGQLTypeName({group: "response", propName: fieldName, propSchema: fieldSchema as JSONSchema7})});
		}
		return fieldTypes;
	}
	Response_GetFieldsStr() {
		const return_fieldTypes = this.Response_GetFieldTypes();
		//if (return_fieldTypes.length == 0) return "_"; // results in "{_}", matching the placeholder given in the mutation-declaration
		if (return_fieldTypes.length == 0) return "__typename"; // results in "{__typename}", matching the placeholder given in the mutation-declaration
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
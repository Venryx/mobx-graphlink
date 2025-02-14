import { Assert, CE, WaitXThenRun } from "js-vextensions";
import { GetGQLSchemaInfoFromJSONSchema, NormalizeGQLTypeName } from "../Extensions/GQLSchemaHelpers.js";
import { GetSchemaJSON, IsJSONSchemaOfTypeScalar, IsJSONSchemaScalar, JSONSchemaScalarTypeToGraphQLScalarType } from "../Extensions/JSONSchemaHelpers.js";
// I don't think this class/file is really needed anymore; however, I'm keeping it here for the moment, since it's still called from some files in project 1. (called to register metadata that isn't necessary anymore)
export function CommandMeta(opts) {
    return (constructor) => {
        Assert(!commandClasses.includes(constructor), `This exact command-class was already registered. @name:${constructor.name}`);
        commandClasses.push(constructor);
        Assert(!commandClassMetadata.has(constructor.name), `A command-class was already registered with this name (${constructor.name}), but a different instance.`);
        const metadata = new CommandClassMetadata({
            commandClass: constructor,
            payloadSchemaGetter: opts.payloadSchema,
            returnSchemaGetter: opts.returnSchema,
            defaultPayload: opts.defaultPayload,
            //extraDBUpdates: opts.extraDBUpdates,
            exposeToGraphQL: opts.exposeToGraphQL,
        });
        commandClassMetadata.set(constructor.name, metadata);
        // wait a moment before calculating derivatives (we need to make sure all schema-deps are added first)
        WaitXThenRun(0, () => metadata.CalculateDerivatives());
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
export const commandClasses = new Array();
export function GetCommandClass(name) {
    return commandClasses.find(a => a.name == name);
}
export const commandClassMetadata = new Map();
export function GetCommandClassMetadata(name) {
    Assert(commandClassMetadata.has(name), `Cannot find command-class-metadata for: ${name}`);
    return commandClassMetadata.get(name);
}
export function GetCommandClassMetadatas() {
    return Array.from(commandClassMetadata.values());
}
export class CommandClassMetadata {
    constructor(data) {
        this.defaultPayload = {};
        //extraDBUpdates?: (helper: DBHelper)=>any;
        this.exposeToGraphQL = true;
        Object.assign(this, CE(data !== null && data !== void 0 ? data : {}).OmitUndefined());
        //this.CalculateDerivatives();
    }
    CalculateDerivatives() {
        var _a, _b, _c, _d;
        this.payloadSchema = (_b = (_a = this.payloadSchemaGetter) === null || _a === void 0 ? void 0 : _a.call(this)) !== null && _b !== void 0 ? _b : {};
        this.returnSchema = (_d = (_c = this.returnSchemaGetter) === null || _c === void 0 ? void 0 : _c.call(this)) !== null && _d !== void 0 ? _d : {};
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
            jsonSchema: this.payloadSchema,
            direction: "input",
        });
        this.return_graphqlInfo = GetGQLSchemaInfoFromJSONSchema({
            rootName: `${this.commandClass.name}_ReturnData`,
            jsonSchema: this.returnSchema,
        });
    }
    // eslint-disable-next-line no-loop-func
    FindGQLTypeName(opts) {
        var _a, _b;
        if (opts.propName) {
            if (opts.propSchema) {
                const result = this.FindGQLTypeNameForFieldSchema(opts.group, opts.propSchema);
                if (result != null)
                    return result;
            }
            const groupInfo = opts.group == "payload" ? this.payloadSchema : this.returnSchema;
            const fieldSchema = (_a = groupInfo.properties) === null || _a === void 0 ? void 0 : _a[opts.propName];
            if (fieldSchema) {
                const result = this.FindGQLTypeNameForFieldSchema(opts.group, fieldSchema);
                if (result != null)
                    return result;
            }
        }
        const typeName = opts.typeName
            ? opts.typeName // eg. UpdateTerm_ReturnData
            : `${this.commandClass.name}_Payload.${opts.propName}`; // eg. UpdateTerm_Payload.id
        const typeName_normalized = NormalizeGQLTypeName(typeName);
        const schemaInfo = opts.group == "payload" ? this.payload_graphqlInfo : this.return_graphqlInfo;
        const typeDefNames_normalized = schemaInfo.typeDefs.map(typeDef => {
            //return typeDef.name?.replace(/(T0)+/g, ".").toLowerCase().slice(0, -1); // UpdateTermT0UpdatesT0 -> updateterm.updates
            //return typeDef.name?.toLowerCase(); // UpdateTermUpdates -> updatetermupdates
            return NormalizeGQLTypeName(typeDef.name);
        });
        const result = schemaInfo.typeDefs[typeDefNames_normalized.findIndex(a => a == typeName_normalized)];
        Assert(result, `Could not find type-def for type/prop name "${(_b = opts.typeName) !== null && _b !== void 0 ? _b : opts.propName}". Did you forget to add a schema dependency?${""}\n\t@typeName_normalized:${typeName_normalized}\n\t@typeDefNames_normalized:${typeDefNames_normalized.join(",")}\n\t@typeDefStrings:${schemaInfo.typeDefs.map(a => a.str)}\n\t@group:${opts.group}`);
        return result.name;
    }
    FindGQLTypeNameForFieldSchema(group, fieldSchema) {
        if (fieldSchema.$ref != null) {
            const schemaName = fieldSchema.$ref;
            const schema = GetSchemaJSON(schemaName);
            if (IsJSONSchemaOfTypeScalar(schema)) {
                // graphql types can't represent scalars (eg. with constraints) as separate types; so replace a ref to such a type with its scalar type
                return JSONSchemaScalarTypeToGraphQLScalarType(schema.type);
            }
            return `${schemaName}T0`; // to match with "get-graphql-from-jsonschema" output
        }
        if (fieldSchema.type) {
            let type_normalized;
            if (typeof fieldSchema.type == "string")
                type_normalized = fieldSchema.type;
            else if (fieldSchema.type instanceof Array) {
                const nonNullTypes = fieldSchema.type.filter(a => a != "null");
                if (nonNullTypes.length == 1)
                    type_normalized = nonNullTypes[0];
            }
            if (type_normalized && IsJSONSchemaScalar(type_normalized)) {
                return JSONSchemaScalarTypeToGraphQLScalarType(type_normalized);
            }
        }
        // if we're dealing with an array, recall this function with the schema for the items
        if (fieldSchema.items != null && typeof fieldSchema.items == "object") {
            const result = this.FindGQLTypeNameForFieldSchema(group, fieldSchema.items);
            if (result)
                return `[${result}]`;
        }
    }
    GetArgTypes() {
        var _a;
        const meta = GetCommandClassMetadata(this.commandClass.name);
        const argGQLTypeNames = [];
        for (const [propName, propSchema] of Object.entries((_a = meta.payloadSchema.properties) !== null && _a !== void 0 ? _a : {})) {
            argGQLTypeNames.push({ name: propName, type: this.FindGQLTypeName({ group: "payload", propName, propSchema: propSchema }) });
        }
        return argGQLTypeNames;
    }
    // for mutation graph-ql declaration/type
    Args_GetArgDefsStr() {
        return this.GetArgTypes().map(a => `${a.name}: ${a.type}`).join(", ");
    }
    // for mutation calls
    Args_GetVarDefsStr() {
        return this.GetArgTypes().map(a => `$${a.name}: ${a.type}`).join(", ");
    }
    /*GetArgNames() {
        const meta = GetCommandClassMetadata(this.commandClass.name);
        return Object.keys(meta.payloadInfo.properties ?? {});
    }*/
    Args_GetArgsUsageStr() {
        return this.GetArgTypes().map(a => `${a.name}: $${a.name}`).join(", ");
    }
    Return_GetFieldTypes() {
        var _a;
        const meta = GetCommandClassMetadata(this.commandClass.name);
        const fieldTypes = [];
        for (const [fieldName, fieldSchema] of Object.entries((_a = meta.returnSchema.properties) !== null && _a !== void 0 ? _a : {})) {
            fieldTypes.push({ name: fieldName, type: this.FindGQLTypeName({ group: "return", propName: fieldName, propSchema: fieldSchema }) });
        }
        return fieldTypes;
    }
    Return_GetFieldsStr() {
        const return_fieldTypes = this.Return_GetFieldTypes();
        if (return_fieldTypes.length == 0)
            return "_"; // results in "{_}", matching the placeholder given in the mutation-declaration
        return return_fieldTypes.map(a => a.name).join("\n");
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

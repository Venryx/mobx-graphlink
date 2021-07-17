import { Assert, CE, WaitXThenRun } from "js-vextensions";
import { getGraphqlSchemaFromJsonSchema } from "get-graphql-from-jsonschema";
export function CommandMeta(opts) {
    return (constructor) => {
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
        WaitXThenRun(0, () => metadata.CalculateDerivatives());
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
        Object.assign(this, data);
        //this.CalculateDerivatives();
    }
    CalculateDerivatives() {
        var _a, _b, _c, _d;
        this.payloadSchema = FinalizeSchemaForClassInfos((_b = (_a = this.payloadSchemaGetter) === null || _a === void 0 ? void 0 : _a.call(this)) !== null && _b !== void 0 ? _b : {});
        this.returnSchema = FinalizeSchemaForClassInfos((_d = (_c = this.returnSchemaGetter) === null || _c === void 0 ? void 0 : _c.call(this)) !== null && _d !== void 0 ? _d : {});
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
        const payload_graphqlSchemaInfo = getGraphqlSchemaFromJsonSchema({
            rootName: this.commandClass.name,
            schema: this.payloadSchema,
            direction: "input",
        });
        this.payload_typeName = payload_graphqlSchemaInfo.typeName;
        this.payload_typeDefs = AugmentTypeDefs(payload_graphqlSchemaInfo.typeDefinitions);
        const returnData_graphqlSchemaInfo = getGraphqlSchemaFromJsonSchema({
            rootName: `${this.commandClass.name}_ReturnData`,
            schema: this.returnSchema,
        });
        this.return_typeName = returnData_graphqlSchemaInfo.typeName;
        this.return_typeDefs = AugmentTypeDefs(returnData_graphqlSchemaInfo.typeDefinitions);
        function AugmentTypeDefs(typeDefs) {
            return typeDefs.map(typeDef => {
                var _a;
                //const typeName = typeDef.match(/type (.+?) {/)?.[1];
                //const typeName = typeDef.match(/type (.+?)( |$)/)?.[1];
                const typeName = (_a = typeDef.match(/(type|input) (.+?)( |$)/)) === null || _a === void 0 ? void 0 : _a[2];
                Assert(typeName, `Could not find type-name in type-def: ${typeDef}`);
                return { name: typeName, str: typeDef };
            });
        }
    }
    // eslint-disable-next-line no-loop-func
    FindGQLTypeName(opts) {
        var _a, _b;
        if (opts.propName) {
            const groupInfo = opts.group == "payload" ? this.payloadSchema : this.returnSchema;
            const fieldJSONSchema = (_a = groupInfo.properties) === null || _a === void 0 ? void 0 : _a[opts.propName];
            if ((fieldJSONSchema === null || fieldJSONSchema === void 0 ? void 0 : fieldJSONSchema.type) == "string")
                return "String";
            if ((fieldJSONSchema === null || fieldJSONSchema === void 0 ? void 0 : fieldJSONSchema.type) == "number")
                return "Float";
            if ((fieldJSONSchema === null || fieldJSONSchema === void 0 ? void 0 : fieldJSONSchema.type) == "boolean")
                return "Boolean";
        }
        const typeName_normalized = opts.typeName
            ? opts.typeName.toLowerCase() // UpdateTerm_Return -> updateterm_return
            : `${this.commandClass.name}.${opts.propName}`.toLowerCase(); // id -> updateterm.id
        const typeDefs = opts.group == "payload" ? this.payload_typeDefs : this.return_typeDefs;
        const typeDefNames_normalized = typeDefs.map(typeDef => {
            var _a;
            return (_a = typeDef.name) === null || _a === void 0 ? void 0 : _a.replace(/(T0)+/g, ".").toLowerCase().slice(0, -1); // UpdateTermT0UpdatesT0 -> updateterm.updates
        });
        const result = typeDefs[typeDefNames_normalized.findIndex(a => a == typeName_normalized)];
        Assert(result, `Could not find type-def for type/prop name "${(_b = opts.typeName) !== null && _b !== void 0 ? _b : opts.propName}". @typeName_normalized:${typeName_normalized} @typeDefNames_normalized:${typeDefNames_normalized.join(",")}`);
        return result.name;
    }
    GetArgTypes() {
        var _a;
        const meta = GetCommandClassMetadata(this.commandClass.name);
        const argGQLTypeNames = [];
        for (const propName of Object.keys((_a = meta.payloadSchema.properties) !== null && _a !== void 0 ? _a : {})) {
            argGQLTypeNames.push({ name: propName, type: this.FindGQLTypeName({ group: "payload", propName }) });
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
        for (const fieldName of Object.keys((_a = meta.returnSchema.properties) !== null && _a !== void 0 ? _a : {})) {
            fieldTypes.push({ name: fieldName, type: this.FindGQLTypeName({ group: "return", propName: fieldName }) });
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
export function FinalizeSchemaForClassInfos(schema) {
    var _a;
    // make sure "type" is specified
    if (schema.type == null) {
        if (schema.$ref == "UUID")
            schema.type = "string";
        else
            schema.type = "object";
    }
    // make sure type does not contain "null" as an option
    if (schema.type instanceof Array && schema.type.includes("null")) {
        schema.type = CE(schema.type).Except("null");
    }
    // if type:array, make sure "items" is specified
    if (schema.type == "array" && schema.items == null) {
        schema.items = FinalizeSchemaForClassInfos({});
    }
    // if type:object, make sure "properties" is specified
    if (schema.type == "object" && schema.properties == null) {
        schema.properties = {};
    }
    // apply the same fixes for sub-schemas
    for (const [propName, propSchema] of Object.entries((_a = schema.properties) !== null && _a !== void 0 ? _a : {})) {
        if (typeof propSchema == "object") {
            FinalizeSchemaForClassInfos(propSchema);
        }
    }
    return schema;
}

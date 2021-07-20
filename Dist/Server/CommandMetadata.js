import { Assert, WaitXThenRun } from "js-vextensions";
import { GetGQLSchemaInfoFromJSONSchema } from "../Extensions/GQLSchemaHelpers.js";
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
            rootName: this.commandClass.name,
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
        var _a, _b, _c;
        if (opts.propName) {
            if (((_a = opts.propSchema) === null || _a === void 0 ? void 0 : _a.$ref) != null)
                return opts.propSchema.$ref;
            const groupInfo = opts.group == "payload" ? this.payloadSchema : this.returnSchema;
            const fieldJSONSchema = (_b = groupInfo.properties) === null || _b === void 0 ? void 0 : _b[opts.propName];
            let type_normalized = fieldJSONSchema === null || fieldJSONSchema === void 0 ? void 0 : fieldJSONSchema.type;
            if (type_normalized instanceof Array) {
                const nonNullTypes = type_normalized.filter(a => a != "null");
                if (nonNullTypes.length == 1)
                    type_normalized = nonNullTypes[0];
            }
            if (type_normalized == "string")
                return "String";
            if (type_normalized == "number")
                return "Float";
            if (type_normalized == "boolean")
                return "Boolean";
        }
        function NormalizeTypeName(typeName) {
            return typeName.toLowerCase().replace(/[^a-z]/g, ""); // to match with "jsonschema2graphql"
        }
        const typeName = opts.typeName
            ? opts.typeName // eg. UpdateTerm_ReturnData
            : `${this.commandClass.name}.${opts.propName}`; // eg. UpdateTerm.id
        const typeName_normalized = NormalizeTypeName(typeName);
        const schemaInfo = opts.group == "payload" ? this.payload_graphqlInfo : this.return_graphqlInfo;
        const typeDefNames_normalized = schemaInfo.typeDefs.map(typeDef => {
            //return typeDef.name?.replace(/(T0)+/g, ".").toLowerCase().slice(0, -1); // UpdateTermT0UpdatesT0 -> updateterm.updates
            //return typeDef.name?.toLowerCase(); // UpdateTermUpdates -> updatetermupdates
            return NormalizeTypeName(typeDef.name);
        });
        const result = schemaInfo.typeDefs[typeDefNames_normalized.findIndex(a => a == typeName_normalized)];
        Assert(result, `Could not find type-def for type/prop name "${(_c = opts.typeName) !== null && _c !== void 0 ? _c : opts.propName}".${""}\n@typeName_normalized:${typeName_normalized}\n@typeDefNames_normalized:${typeDefNames_normalized.join(",")}\n@lastTypeDef_str:${schemaInfo.typeDefs.slice(-1)[0].str}`);
        return result.name;
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

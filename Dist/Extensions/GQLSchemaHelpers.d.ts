import { JSONSchema7 } from "json-schema";
export declare function FinalizeSchemaForConversionToGraphQL(schema: JSONSchema7): JSONSchema7;
export declare class TypeDef {
    type: "type" | "input" | "union";
    name: string;
    str: string;
    strIndexInSchemaStr: number;
}
export declare class GraphQLSchemaInfo {
    typeName: string;
    schemaAsStr: string;
    typeDefs: TypeDef[];
}
export declare function GetGQLSchemaInfoFromJSONSchema(opts: {
    rootName: string;
    jsonSchema: JSONSchema7;
    direction?: "input" | "output";
}): GraphQLSchemaInfo;
/** For use in graph-ql calls of queries and mutations. */
export declare function ConstructGQLArgsStr(argsObj: Object, args_rawPrefixStr?: string | null): string;
/** For use in mutation-resolver declarations/types. */
export declare function ConstructGQLArgTypesStr(argTypesObj: Object, argTypes_rawPrefixStr?: string | null): string;

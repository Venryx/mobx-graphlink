import { JSONSchema7 } from "json-schema";
export declare function FinalizeSchemaForConversionToGraphQL(schema: JSONSchema7, refPath?: string[]): void;
export declare class TypeDef {
    type: "type" | "input" | "union" | "rootTypeExtension";
    name: string;
    str: string;
    strIndexInSchemaStr?: number;
}
export declare class GraphQLSchemaInfo {
    constructor(data?: Partial<GraphQLSchemaInfo>);
    typeName: string;
    typeDefs: TypeDef[];
    get TypeDefs_AsSchemaStr(): string;
}
export declare function NormalizeGQLTypeName(typeName: string): string;
export declare function GetGQLSchemaInfoFromJSONSchema(opts: {
    rootName: string;
    jsonSchema: JSONSchema7;
    direction?: "input" | "output";
}): GraphQLSchemaInfo;
/** For use in graph-ql calls of queries and mutations. */
export declare function ConstructGQLArgsStr(argsObj: Object, args_rawPrefixStr?: string | null): string;
/** For use in mutation-resolver declarations/types. */
export declare function ConstructGQLArgTypesStr(argTypesObj: Object, argTypes_rawPrefixStr?: string | null): string;

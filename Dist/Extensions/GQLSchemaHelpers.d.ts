import { JSONSchema7 } from "json-schema";
export declare function GetGQLSchemaFromJSONSchema(opts: {
    rootName: string;
    schema: JSONSchema7;
    direction?: "input" | "output";
}): {
    typeName: string;
    typeDefinitions: string[];
};
/** For use in graph-ql calls of queries and mutations. */
export declare function ConstructGQLArgsStr(argsObj: Object, args_rawPrefixStr?: string | null): string;
/** For use in mutation-resolver declarations/types. */
export declare function ConstructGQLArgTypesStr(argTypesObj: Object, argTypes_rawPrefixStr?: string | null): string;

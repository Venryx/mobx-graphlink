export declare type SchemaModifiers = {
    includeOnly?: string[];
};
export declare function DeriveJSONSchema(typeName: string, modifiers: SchemaModifiers): Object;
/** For use in graph-ql calls of queries and mutations. */
export declare function ConstructGQLArgsStr(argsObj: Object, args_rawPrefixStr?: string | null): string;
/** For use in mutation-resolver declarations/types. */
export declare function ConstructGQLArgTypesStr(argTypesObj: Object, argTypes_rawPrefixStr?: string | null): string;

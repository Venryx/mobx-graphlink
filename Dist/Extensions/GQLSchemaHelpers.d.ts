export declare function NormalizeGQLTypeName(typeName: string): string;
/** For use in graph-ql calls of queries and mutations. */
export declare function ConstructGQLArgsStr(argsObj: Object, args_rawPrefixStr?: string | null): string;
/** For use in mutation-resolver declarations/types. */
export declare function ConstructGQLArgTypesStr(argTypesObj: Object, argTypes_rawPrefixStr?: string | null): string;

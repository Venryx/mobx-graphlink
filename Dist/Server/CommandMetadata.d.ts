import { Command } from "./Command.js";
import { JSONSchema7 } from "json-schema";
import { GraphQLSchemaInfo } from "../Extensions/GQLSchemaHelpers.js";
export declare function CommandMeta(opts: {
    payloadSchema: () => JSONSchema7;
    returnSchema?: () => JSONSchema7;
    defaultPayload?: any;
}): (constructor: typeof Command) => void;
export declare const commandClasses: (typeof Command)[];
export declare function GetCommandClass(name: string): typeof Command | undefined;
export declare const commandClassMetadata: Map<string, CommandClassMetadata>;
export declare function GetCommandClassMetadata(name: string): CommandClassMetadata;
export declare function GetCommandClassMetadatas(): CommandClassMetadata[];
export declare class CommandClassMetadata {
    constructor(data?: Partial<CommandClassMetadata>);
    commandClass: typeof Command;
    payloadSchemaGetter: (() => JSONSchema7) | null | undefined;
    returnSchemaGetter: (() => JSONSchema7) | null | undefined;
    defaultPayload: {};
    payloadSchema: JSONSchema7;
    returnSchema: JSONSchema7;
    payload_graphqlInfo: GraphQLSchemaInfo;
    return_graphqlInfo: GraphQLSchemaInfo;
    CalculateDerivatives(): void;
    FindGQLTypeName(opts: {
        group: "payload" | "return";
        typeName?: string;
        propName?: string;
        propSchema?: JSONSchema7;
    }): string;
    GetArgTypes(): {
        name: string;
        type: string;
    }[];
    Args_GetArgDefsStr(): string;
    Args_GetVarDefsStr(): string;
    Args_GetArgsUsageStr(): string;
    Return_GetFieldTypes(): {
        name: string;
        type: string;
    }[];
    Return_GetFieldsStr(): string;
}

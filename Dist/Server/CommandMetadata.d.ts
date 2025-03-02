import { JSONSchema7 } from "json-schema";
import { Command } from "./Command.js";
export declare function CommandMeta(opts: {
    inputSchema: () => JSONSchema7;
    responseSchema?: () => JSONSchema7;
    defaultInput?: any;
    exposeToGraphQL?: boolean;
}): (constructor: typeof Command) => void;
export declare const commandClasses: (typeof Command)[];
export declare function GetCommandClass(name: string): typeof Command | undefined;
export declare const commandClassMetadata: Map<string, CommandClassMetadata>;
export declare function GetCommandClassMetadata(name: string): CommandClassMetadata;
export declare function GetCommandClassMetadatas(): CommandClassMetadata[];
export declare class CommandClassMetadata {
    constructor(data?: Partial<CommandClassMetadata>);
    commandClass: typeof Command;
    inputSchemaGetter: (() => JSONSchema7) | null | undefined;
    responseSchemaGetter: (() => JSONSchema7) | null | undefined;
    defaultInput: {};
    exposeToGraphQL: boolean;
    inputSchema: JSONSchema7;
    responseSchema: JSONSchema7;
    CalculateDerivatives(): void;
    FindGQLTypeName(opts: {
        group: "input" | "response";
        typeName?: string;
        propName?: string;
        propSchema?: JSONSchema7;
    }): any;
    FindGQLTypeNameForFieldSchema(group: "input" | "response", fieldSchema: JSONSchema7): any;
    GetArgTypes(): {
        name: string;
        type: string;
    }[];
    Args_GetArgDefsStr(): string;
    Args_GetVarDefsStr(): string;
    Args_GetArgsUsageStr(): string;
    Args_GetVarDefsStr_New(): string;
    Args_GetArgsUsageStr_New(): string;
    Response_GetFieldTypes(): {
        name: string;
        type: string;
    }[];
    Response_GetFieldsStr(): string;
}

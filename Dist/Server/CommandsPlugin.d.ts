import { PoolClient } from "pg";
import { Context as Context_base } from "postgraphile";
import { TypeDef } from "../Extensions/GQLSchemaHelpers.js";
import { Command } from "./Command.js";
declare type Context = Context_base<any> & {
    pgClient: PoolClient;
};
export declare class CommandRunInfo {
    parent: any;
    args: any[];
    context: Context;
    info: any;
    command: Command<any>;
}
export declare class CreateCommandPlugin_Options {
    schemaDeps_auto?: boolean;
    schemaDeps_auto_exclude?: string[];
    schemaDeps?: string[];
    typeDefFinalizer?: (typeDef: TypeDef) => TypeDef;
    typeDefStrFinalizer?: (str: string) => string;
    logTypeDefs?: boolean;
    logTypeDefs_detailed?: string[];
    preCommandRun?: (info: CommandRunInfo) => any;
    postCommandRun?: (info: CommandRunInfo & {
        returnData: any;
        error: any;
    }) => any;
}
export declare let CommandsPlugin_opts: CreateCommandPlugin_Options;
export declare const CreateCommandsPlugin: (opts: CreateCommandPlugin_Options) => import("postgraphile").Plugin;
export {};

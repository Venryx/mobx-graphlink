import { PoolClient } from "pg";
import { Context as Context_base } from "postgraphile";
import { Command } from "./Command.js";
declare type Context = Context_base<any> & {
    pgClient: PoolClient;
};
declare class CommandRunInfo {
    parent: any;
    args: any[];
    context: Context;
    info: any;
    command: Command<any>;
}
declare class CreateCommandPlugin_Options {
    preCommandRun?: (info: CommandRunInfo) => any;
    postCommandRun?: (info: CommandRunInfo & {
        returnData: any;
        error: any;
    }) => any;
}
export declare const CreateCommandsPlugin: (opts: CreateCommandPlugin_Options) => import("postgraphile").Plugin;
export {};

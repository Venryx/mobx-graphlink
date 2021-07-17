import { Command } from "./Command.js";
import { JSONSchema7 } from "json-schema";
export declare const commandClasses: (typeof Command)[];
export declare function GetCommandClass(name: string): typeof Command | undefined;
export declare function CommandMeta(opts: {
    payloadInfo: () => JSONSchema7;
    returnInfo?: () => JSONSchema7;
}): (constructor: typeof Command) => void;

import { Assert } from "js-vextensions";
export const commandClasses = new Array();
export function GetCommandClass(name) {
    return commandClasses.find(a => a.name == name);
}
/*export interface CombinedFieldSchema {
    jsonSchema: Object;
    gqlSchema: string;
}
export interface CombinedObjectSchema {
    [key: string]: CombinedFieldSchema;
    required: string[];
}*/
export function CommandMeta(opts) {
    return (constructor) => {
        Assert(!commandClasses.includes(constructor));
        commandClasses.push(constructor);
        constructor["_payloadInfoGetter"] = opts.payloadInfo;
        constructor["_returnInfoGetter"] = opts.returnInfo;
    };
}

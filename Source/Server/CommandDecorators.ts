import {Assert} from "js-vextensions";
import {Command} from "./Command.js";
import {JSONSchema7} from "json-schema";

export const commandClasses = new Array<typeof Command>();
export function GetCommandClass(name: string) {
	return commandClasses.find(a=>a.name == name);
}

/*export interface CombinedFieldSchema {
	jsonSchema: Object;
	gqlSchema: string;
}
export interface CombinedObjectSchema {
	[key: string]: CombinedFieldSchema;
	required: string[];
}*/

export function CommandMeta(opts: {
	payloadInfo: ()=>JSONSchema7,
	returnInfo?: ()=>JSONSchema7,
}) {
	return (constructor: typeof Command)=>{
		Assert(!commandClasses.includes(constructor));
		commandClasses.push(constructor);

		constructor["_payloadInfoGetter"] = opts.payloadInfo;
		constructor["_returnInfoGetter"] = opts.returnInfo;
	};
}
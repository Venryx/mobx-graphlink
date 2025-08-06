import {JSONStringify_NoQuotesForKeys} from "../Utils/General/General.js";

export function NormalizeGQLTypeName(typeName: string) {
	//return typeName.toLowerCase().replace(/[^a-z]/g, "");
	// normalize types from "get-graphql-from-jsonschema": MapNodeT0TypeT0 -> MapNode.Type, ChangeClaimType_Payload.NewType -> ChangeClaimType_Payload.newType
	if (typeName.includes("T0")) {
		return typeName
			.replace(/T0/g, ".")
			.replace(/\.[A-Z]/g, str=>str.toLowerCase())
			.replace(/\.$/, "");
	}
	// normalize directly-passed class/type names: MapNode_Partial -> MapNode_Partial (no change needed)
	return typeName;
}

/** For use in graph-ql calls of queries and mutations. */
export function ConstructGQLArgsStr(argsObj: Object, args_rawPrefixStr?: string|null) {
	//const argsAsStr_json = Object.keys(argsObj).length ? JSON.stringify(argsObj) : "";
	const argsAsStr_json = Object.keys(argsObj).length ? JSONStringify_NoQuotesForKeys(argsObj) : "";
	const argsStr_parts = [
		args_rawPrefixStr,
		argsAsStr_json.slice(1, -1), // remove "{}"
	].filter(a=>a);
	return argsStr_parts.join(", ");
}
/** For use in mutation-resolver declarations/types. */
export function ConstructGQLArgTypesStr(argTypesObj: Object, argTypes_rawPrefixStr?: string|null) {
	return ConstructGQLArgsStr(argTypesObj, argTypes_rawPrefixStr).replace(/"/g, "");
}
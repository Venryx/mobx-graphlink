import {Assert, CE} from "js-vextensions";
import {DBPPath} from "./DBPaths.js";
import {SplitStringBySlash_Cached} from "./StringSplitCache.js";

export class DBValueWrapper {
	value: any;
	merge = false;
}
export function WrapDBValue(value: any, otherFlags: Partial<Omit<DBValueWrapper, "value">>) {
	let result = new DBValueWrapper();
	result.value = value;
	Object.assign(result, otherFlags);
	return result;
}

export enum DBUpdateType {
	set = "set",
	//delete = "delete",
}

export class DBUpdate {
	constructor(data: Omit<DBUpdate, "PathSegments" | "PathSegments_Plain">) {
		Object.assign(this, data);
	}
	
	type: DBUpdateType;
	path: DBPPath;
	get PathSegments() {
		//return SplitStringBySlash_Cached(this.path);
		return this.path.split("/");
	}
	get PathSegments_Plain() {
		return this.PathSegments.map(a=>a.replace(".", ""));
	}
	value?: any;
}
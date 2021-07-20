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
	CE(result).VSet(otherFlags);
	return result;
}

export enum DBUpdateType {
	set = "set",
	//delete = "delete",
}

export class DBUpdate {
	constructor(data: Omit<DBUpdate, "PathSegments">) {
		CE(this).VSet(data);
	}
	
	type: DBUpdateType;
	path: DBPPath;
	get PathSegments() {
		//return SplitStringBySlash_Cached(this.path);
		return this.path.split("/");
	}
	value?: any;
}
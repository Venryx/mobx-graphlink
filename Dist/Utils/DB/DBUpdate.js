import { CE } from "js-vextensions";
export class DBValueWrapper {
    constructor() {
        this.merge = false;
    }
}
export function WrapDBValue(value, otherFlags) {
    let result = new DBValueWrapper();
    result.value = value;
    CE(result).VSet(otherFlags);
    return result;
}
export var DBUpdateType;
(function (DBUpdateType) {
    DBUpdateType["set"] = "set";
    //delete = "delete",
})(DBUpdateType || (DBUpdateType = {}));
export class DBUpdate {
    constructor(data) {
        CE(this).VSet(data);
    }
    get PathSegments() {
        //return SplitStringBySlash_Cached(this.path);
        return this.path.split("/");
    }
    get PathSegments_Plain() {
        return this.PathSegments.map(a => a.replace(".", ""));
    }
}

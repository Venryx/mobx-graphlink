export class DBValueWrapper {
    constructor() {
        this.merge = false;
    }
}
export function WrapDBValue(value, otherFlags) {
    let result = new DBValueWrapper();
    result.value = value;
    Object.assign(result, otherFlags);
    return result;
}
export var DBUpdateType;
(function (DBUpdateType) {
    DBUpdateType["set"] = "set";
    //delete = "delete",
})(DBUpdateType || (DBUpdateType = {}));
export class DBUpdate {
    constructor(data) {
        Object.assign(this, data);
    }
    get PathSegments() {
        //return SplitStringBySlash_Cached(this.path);
        return this.path.split("/");
    }
    get PathSegments_Plain() {
        return this.PathSegments.map(a => a.replace(".", ""));
    }
}

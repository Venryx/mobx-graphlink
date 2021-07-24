import { CE } from "js-vextensions";
export class DBValueWrapper {
    constructor() {
        Object.defineProperty(this, "value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "merge", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
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
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        CE(this).VSet(data);
    }
    get PathSegments() {
        //return SplitStringBySlash_Cached(this.path);
        return this.path.split("/");
    }
}

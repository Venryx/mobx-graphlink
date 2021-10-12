import { DBPPath } from "./DBPaths.js";
export declare class DBValueWrapper {
    value: any;
    merge: boolean;
}
export declare function WrapDBValue(value: any, otherFlags: Partial<Omit<DBValueWrapper, "value">>): DBValueWrapper;
export declare enum DBUpdateType {
    set = "set"
}
export declare class DBUpdate {
    constructor(data: Omit<DBUpdate, "PathSegments" | "PathSegments_Plain">);
    type: DBUpdateType;
    path: DBPPath;
    get PathSegments(): string[];
    get PathSegments_Plain(): string[];
    value?: any;
}

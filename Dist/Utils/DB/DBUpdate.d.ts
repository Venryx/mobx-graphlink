export declare class DBValueWrapper {
    value: any;
    merge: boolean;
}
export declare function WrapDBValue(value: any, otherFlags: Partial<Omit<DBValueWrapper, "value">>): DBValueWrapper;
export declare enum DBUpdateType {
    set = "set"
}
export declare class DBUpdate {
    constructor(data: Omit<DBUpdate, "PathSegments">);
    type: DBUpdateType;
    path: string;
    get PathSegments(): string[];
    value?: any;
}

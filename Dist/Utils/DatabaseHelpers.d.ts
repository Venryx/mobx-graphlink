import { GraphOptions } from "../index.js";
export declare function IsAuthValid(auth: any): any;
export declare function ProcessDBData(data: any, addHelpers: boolean, rootKey?: string): any;
export declare function AssertValidatePath(path: string): void;
export declare function ConvertDataToValidDBUpdates(versionPath: string, versionData: any, dbUpdatesRelativeToVersionPath?: boolean): {};
export declare class DBValueWrapper {
    value: any;
    merge: boolean;
}
export declare function WrapDBValue(value: any, otherFlags: Partial<Omit<DBValueWrapper, "value">>): DBValueWrapper;
export declare class ApplyDBUpdates_Options {
    static default: ApplyDBUpdates_Options;
}
export declare function FinalizeDBUpdates(options: Partial<GraphOptions & ApplyDBUpdates_Options>, dbUpdates: Object, rootPath_override?: string): Object;
export declare function ApplyDBUpdates(options: Partial<GraphOptions & ApplyDBUpdates_Options>, dbUpdates: Object, rootPath_override?: string): Promise<void>;
export declare function ApplyDBUpdates_Local(dbData: any, dbUpdates: Object): any;

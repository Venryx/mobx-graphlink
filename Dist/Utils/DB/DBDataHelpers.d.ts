export declare const CleanType_values: readonly ["hideField_typename", "hideField_underscore", "removeNullFields"];
export declare type CleanType = typeof CleanType_values[number];
export declare function CleanDBData(data: any, cleanTypes?: CleanType[]): any;
export declare function ConvertDataToValidDBUpdates(versionPath: string, versionData: any, dbUpdatesRelativeToVersionPath?: boolean): {};

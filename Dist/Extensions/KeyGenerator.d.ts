export declare type UUID = string;
export declare const UUID_regex_partial = "[A-Za-z0-9_-]{22}";
export declare const UUID_regex: string;
export declare const generatedUUIDHistory: string[];
/** Helper, eg. for if creating a db-seed file, and you need to reference the ID of the previous entry within an array literal. */
export declare function LastUUID(indexAdjustment?: number): string;
export declare function GenerateUUID(avoidUnpleasantStartChars?: boolean): string;

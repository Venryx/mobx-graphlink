export declare type UUID = string;
export declare const UUID_regex_partial = "[A-Za-z0-9_-]{22}";
export declare const UUID_regex: string;
export declare function GenerateUUID(avoidUnpleasantStartChars?: boolean): string;

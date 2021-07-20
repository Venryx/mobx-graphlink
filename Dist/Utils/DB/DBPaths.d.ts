import { DBShape } from "../../UserTypes.js";
export declare function VPathToFBPath(vPath: string): string;
export declare function FBPathToVPath(fbPath: string): string;
export declare function VFieldPathToFBFieldPath(vFieldPath: string): string;
export declare function FBFieldPathToVFieldPath(vFieldPath: string): string;
/**
 * @param asFBPath If true, returned paths are separated with "."; if false, by "/". Default: false
 * @returns [colOrDocPath, fieldPathInDoc]
 * */
export declare function GetPathParts(path: string, asFBPath?: boolean): [string, string | null];
export declare function SlicePath(path: string, removeFromEndCount: number, ...itemsToAdd: string[]): string | null;
export declare function PathOrPathGetterToPath(pathOrPathSegmentsOrPathGetter: string | (string | number)[] | ((placeholder: any) => any)): string;
export declare function PathOrPathGetterToPathSegments(pathOrPathSegmentsOrPathGetter: string | (string | number)[] | ((placeholder: any) => any)): string[];
export declare function AssertValidatePath(path: string): void;
export declare function MobXPathGetterToPath(pathGetterFunc: (dbRoot: DBShape) => any): string;
export declare function MobXPathGetterToPathSegments(pathGetterFunc: (dbRoot: DBShape) => any): string[];
export declare const dbpPrefix = "[@dbp:]";
export declare const DBPPath_Symbol: unique symbol;
/** This is actually just a string with a special prefix; but we pretend it's a unique type, so that TS will warn about basic-strings being put in places where only dbp-template-literals should be. */
export declare type DBPPath = string & {
    _: typeof DBPPath_Symbol;
};
/** When creating db-path strings, always create it using this function to construct the template-literal.
 * It protects from typos like: dbp(`...`) (do this instead: dbp`...`) */
export declare function dbp(strings: TemplateStringsArray, ...vars: string[]): DBPPath;

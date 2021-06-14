import { DBShape } from "../UserTypes.js";
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
export declare function MobXPathGetterToPath(pathGetterFunc: (dbRoot: DBShape) => any): string;
export declare function MobXPathGetterToPathSegments(pathGetterFunc: (dbRoot: DBShape) => any): string[];

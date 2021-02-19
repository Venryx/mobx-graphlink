import {Assert, IsString, E, CE, IsArray, IsFunction} from "js-vextensions";
import {defaultFireOptions, FireOptions} from "../Graphlink";
import {SplitStringBySlash_Cached} from "./StringSplitCache";
import {DBShape} from "../UserTypes";

export function VPathToFBPath(vPath: string) {
	return vPath.replace(/\/\./g, ".");
}
export function FBPathToVPath(fbPath: string) {
	return fbPath.replace(/\./g, "/.");
}
export function VFieldPathToFBFieldPath(vFieldPath: string) {
	return vFieldPath.replace(/\//g, ".");
}
export function FBFieldPathToVFieldPath(vFieldPath: string) {
	return vFieldPath.replace(/\./g, "/");
}

/**
 * @param asFBPath If true, returned paths are separated with "."; if false, by "/". Default: false
 * @returns [colOrDocPath, fieldPathInDoc]
 * */
export function GetPathParts(path: string, asFBPath = false): [string, string|null] {
	let colOrDocPath = path.substr(0, CE(path.indexOf("/.")).IfN1Then(path.length));
	const isDocPath = colOrDocPath.length != path.length; // if length differs, it means field-path is supplied, which means it's a doc-path
	if (isDocPath) {
		Assert(SplitStringBySlash_Cached(colOrDocPath).length % 2 == 0, `Segment count in docPath (${colOrDocPath}) must be multiple of 2.`);
	}

	let fieldPathInDoc = colOrDocPath.length < path.length ? path.substr(colOrDocPath.length + 2).replace(/\./g, "") : null;
	if (asFBPath) {
		[colOrDocPath, fieldPathInDoc] = [VPathToFBPath(colOrDocPath), fieldPathInDoc ? VFieldPathToFBFieldPath(fieldPathInDoc) : null];
	}
	return [colOrDocPath, fieldPathInDoc];
}

export function DBPath(options: Partial<FireOptions>, path = "", inLinkRoot = true) {
	const opt = E(defaultFireOptions, options) as FireOptions;
	Assert(path != null, "Path cannot be null.");
	Assert(typeof path == "string", "Path must be a string.");
	/*let versionPrefix = path.match(/^v[0-9]+/);
	if (versionPrefix == null) // if no version prefix already, add one (referencing the current version)*/
	if (inLinkRoot) {
		path = `${opt.fire.rootPath}${path ? `/${path}` : ""}`;
	}
	return path;
}
export function DBPathSegments(options: Partial<FireOptions>, pathSegments: (string | number)[], inLinkRoot = true) {
	const opt = E(defaultFireOptions, options) as FireOptions;
	let result = pathSegments.map(a=>a?.toString());
	if (inLinkRoot) {
		result = opt.fire.rootPathSegments.concat(result);
	}
	return result;
}

export function SlicePath(path: string, removeFromEndCount: number, ...itemsToAdd: string[]) {
	//let parts = path.split("/");
	const parts = SplitStringBySlash_Cached(path).slice();
	parts.splice(parts.length - removeFromEndCount, removeFromEndCount, ...itemsToAdd);
	if (parts.length == 0) return null;
	return parts.join("/");
}

export function PathOrPathGetterToPath(pathOrPathSegmentsOrPathGetter: string | (string | number)[] | ((placeholder: any)=>any)) {
	if (IsString(pathOrPathSegmentsOrPathGetter)) return pathOrPathSegmentsOrPathGetter;
	if (IsArray(pathOrPathSegmentsOrPathGetter)) return pathOrPathSegmentsOrPathGetter.map(a=>a?.toString()).join("/");
	if (IsFunction(pathOrPathSegmentsOrPathGetter)) return MobXPathGetterToPath(pathOrPathSegmentsOrPathGetter);
	return null as never;
}
export function PathOrPathGetterToPathSegments(pathOrPathSegmentsOrPathGetter: string | (string | number)[] | ((placeholder: any)=>any)) {
	if (IsString(pathOrPathSegmentsOrPathGetter)) return pathOrPathSegmentsOrPathGetter.split("/");
	if (IsArray(pathOrPathSegmentsOrPathGetter)) return pathOrPathSegmentsOrPathGetter.map(a=>a?.toString());
	if (IsFunction(pathOrPathSegmentsOrPathGetter)) return MobXPathGetterToPathSegments(pathOrPathSegmentsOrPathGetter);
	return [];
}

export function MobXPathGetterToPath(pathGetterFunc: (dbRoot: DBShape)=>any) {
	return MobXPathGetterToPathSegments(pathGetterFunc).join("/");
}
export function MobXPathGetterToPathSegments(pathGetterFunc: (dbRoot: DBShape)=>any) {
	let pathSegments = [] as string[];
	let proxy = new Proxy({}, {
		get: (target, key)=> {
			if (key == "get") {
				return (realKey: string)=>{
					pathSegments.push(realKey);
					return proxy;
				}
			}

			pathSegments.push(key?.toString());
			return proxy;
		},
	});
	pathGetterFunc(proxy);
	return pathSegments;
}
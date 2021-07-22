import {Assert, IsString, E, CE, IsArray, IsFunction} from "js-vextensions";
import {defaultGraphOptions, GraphOptions} from "../../Graphlink.js";
import {SplitStringBySlash_Cached} from "./StringSplitCache.js";
import {UT_DBShape} from "../../UserTypes.js";

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

/*export function DBPath(options: Partial<GraphOptions>, path = "", inLinkRoot = true) {
	const opt = E(defaultGraphOptions, options) as GraphOptions;
	Assert(path != null, "Path cannot be null.");
	Assert(typeof path == "string", "Path must be a string.");
	/*let versionPrefix = path.match(/^v[0-9]+/);
	if (versionPrefix == null) // if no version prefix already, add one (referencing the current version)*#/
	if (inLinkRoot) {
		path = `${opt.graph.rootPath}${path ? `/${path}` : ""}`;
	}
	return path;
}
export function DBPathSegments(options: Partial<GraphOptions>, pathSegments: (string | number)[], inLinkRoot = true) {
	const opt = E(defaultGraphOptions, options) as GraphOptions;
	let result = pathSegments.map(a=>a?.toString());
	if (inLinkRoot) {
		result = opt.graph.rootPathSegments.concat(result);
	}
	return result;
}*/

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

export function AssertValidatePath(path: string) {
	Assert(!path.endsWith("/"), "Path cannot end with a slash. (This may mean a path parameter is missing)");
	Assert(!path.includes("//"), "Path cannot contain a double-slash. (This may mean a path parameter is missing)");
}

export function MobXPathGetterToPath(pathGetterFunc: (dbRoot: UT_DBShape)=>any) {
	return MobXPathGetterToPathSegments(pathGetterFunc).join("/");
}
export function MobXPathGetterToPathSegments(pathGetterFunc: (dbRoot: UT_DBShape)=>any) {
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

export const dbpPrefix = "[@dbp:]";
export const DBPPath_Symbol = Symbol("test");
/** This is actually just a string with a special prefix; but we pretend it's a unique type, so that TS will warn about basic-strings being put in places where only dbp-template-literals should be. */
export type DBPPath = string & {_: typeof DBPPath_Symbol};

/** When creating db-path strings, always create it using this function to construct the template-literal.
 * It protects from typos like: dbp(`...`) (do this instead: dbp`...`) */
export function dbp(strings: TemplateStringsArray, ...vars: string[]): DBPPath {
	Assert(vars.length >= 1, `The "dbp" template-literal function requires at least one variable, to protect from typos like: dbp(\`...\`) (do this instead: dbp\`...\`)`);
	for (const expression of vars) {
		Assert(typeof expression == "string", "DB-path-segment variables must be strings.");
		Assert(/^([A-Za-z0-9_\-.]+)$/.test(expression), `DB-path-segment variables must only contain alphanumeric, "_", "-", or "." characters.`);
	}

	// now just default template literal functionality
	let result = dbpPrefix;
	strings.forEach((str, i) => {
		result += `${str}${i == strings.length - 1 ? "" : vars[i]}`;
	});
	return result as any as DBPPath;
}
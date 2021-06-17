import {DeepSet, IsNumberString, Assert, StringCE, Clone, ObjectCE, ArrayCE, GetTreeNodesInObjTree, E, CE, StartDownload, IsObject} from "js-vextensions";
import u from "updeep";
import {MaybeLog_Base} from "./General";
import {GraphOptions, SplitStringBySlash_Cached} from "..";
import {defaultGraphOptions} from "../Graphlink";
import {GetPathParts} from "./PathHelpers";

export function IsAuthValid(auth) {
	return auth && !auth.isEmpty;
}

export function ProcessDBData(data, addHelpers: boolean, rootKey = "_root") {
	if (data == null) return;
	var treeNodes = GetTreeNodesInObjTree(data, true);
	for (const treeNode of treeNodes) {
		if (treeNode.Value == null) continue;

		// add special _key or _id prop
		if (addHelpers && typeof treeNode.Value == "object") {
			const key = treeNode.prop == "_root" ? rootKey : treeNode.prop;
			if (IsNumberString(key)) {
				Object.defineProperty(treeNode.Value, "_id", {enumerable: false, value: parseInt(key)});
			}

			// actually, always set "_key" (in case it's a "_key" that also happens to look like an "_id"/integer)
			//else {
			Object.defineProperty(treeNode.Value, "_key", {enumerable: false, value: key});
		}
	}
	return treeNodes[0].Value; // get possibly-modified wrapper.data
}

export function AssertValidatePath(path: string) {
	Assert(!path.endsWith("/"), "Path cannot end with a slash. (This may mean a path parameter is missing)");
	Assert(!path.includes("//"), "Path cannot contain a double-slash. (This may mean a path parameter is missing)");
}

export function ConvertDataToValidDBUpdates(versionPath: string, versionData: any, dbUpdatesRelativeToVersionPath = true) {
	const result = {};
	for (const {key: pathFromVersion, value: data} of ObjectCE(versionData).Pairs()) {
		const fullPath = `${versionPath}/${pathFromVersion}`;
		const pathForDBUpdates = dbUpdatesRelativeToVersionPath ? pathFromVersion : fullPath;

		// if entry`s "path" has odd number of segments (ie. points to collection), extract the children data into separate set-doc updates
		if (SplitStringBySlash_Cached(fullPath).length % 2 !== 0) {
			for (const {key, value} of ObjectCE(data).Pairs()) {
				result[`${pathForDBUpdates}/${key}`] = value;
			}
		} else {
			result[pathForDBUpdates] = data;
		}
	}
	return result;
}

export class DBValueWrapper {
	value: any;
	merge = false;
}
export function WrapDBValue(value: any, otherFlags: Partial<Omit<DBValueWrapper, "value">>) {
	let result = new DBValueWrapper();
	result.value = value;
	CE(result).VSet(otherFlags);
	return result;
}

//export const maxDBUpdatesPerBatch = 500;
export class ApplyDBUpdates_Options {
	static default = new ApplyDBUpdates_Options();
	//updatesPerChunk = maxDBUpdatesPerBatch;
}

export function FinalizeDBUpdates(options: Partial<GraphOptions & ApplyDBUpdates_Options>, dbUpdates: Object, rootPath_override?: string) {
	const opt = E(defaultGraphOptions, ApplyDBUpdates_Options.default, options) as GraphOptions & ApplyDBUpdates_Options;
	//dbUpdates = WithoutHelpers(Clone(dbUpdates));
	//dbUpdates = Clone(dbUpdates);
	dbUpdates = {...dbUpdates}; // shallow clone, so we preserve DBValueWrappers in entries

	/*let rootPath = rootPath_override ?? opt.graph.rootPath;
	if (rootPath != null && rootPath != "") {
		//for (const {key: localPath, value} of ObjectCE.Pairs(dbUpdates)) {
		for (const {key: localPath, value} of ObjectCE(dbUpdates).Pairs()) {
			dbUpdates[`${rootPath}/${localPath}`] = value;
			delete dbUpdates[localPath];
		}
	}*/
	
	return dbUpdates;
}

export async function ApplyDBUpdates(options: Partial<GraphOptions & ApplyDBUpdates_Options>, dbUpdates: Object, rootPath_override?: string) {
	const opt = E(defaultGraphOptions, ApplyDBUpdates_Options.default, options) as GraphOptions & ApplyDBUpdates_Options;
	dbUpdates = FinalizeDBUpdates(options, dbUpdates, rootPath_override);

	// await firestoreDB.runTransaction(async batch=> {

	const dbUpdates_pairs = ObjectCE(dbUpdates).Pairs();

	MaybeLog_Base(a=>a.commands, l=>l(`Applying db-updates...`));
	//await ApplyDBUpdates_Base(opt, dbUpdates_chunk, rootPath_override);
	// todo
}

export function ApplyDBUpdates_Local(dbData: any, dbUpdates: Object) {
	let result = dbData;
	for (const {key: path, value} of CE(Clone(dbUpdates)).Pairs()) {
		if (value != null) {
			result = u.updateIn(path.replace(/\//g, "."), u.constant(value), result);
		} else {
			result = u.updateIn(path.split("/").slice(0, -1).join("."), u.omit(path.split("/").slice(-1)), result);
		}
	}

	// firebase deletes becoming-empty collections/documents (and we pre-process-delete becoming-empty fields), so we do the same here
	const nodes = GetTreeNodesInObjTree(result, true);
	let emptyNodes;
	do {
		emptyNodes = nodes.filter(a=>typeof a.Value === "object" && (a.Value == null || a.Value.VKeys(true).length === 0));
		for (const node of emptyNodes) {
			delete node.obj[node.prop];
		}
	} while (emptyNodes.length);

	return result;
}
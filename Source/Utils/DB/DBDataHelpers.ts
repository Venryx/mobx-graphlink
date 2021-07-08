import {Assert, GetTreeNodesInObjTree, IsNumberString, ObjectCE} from "js-vextensions";
import {SplitStringBySlash_Cached} from "../../index.js";

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
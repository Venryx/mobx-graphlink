import {Assert, GetTreeNodesInObjTree, IsNumberString, ObjectCE} from "js-vextensions";
import {SplitStringBySlash_Cached} from "../../index.js";

/*export function IsAuthValid(auth) {
	return auth && !auth.isEmpty;
}*/

export function CleanDBData(data) {
	if (data == null) return;

	if (Object.keys(data).includes("__typename")) {
		const typeName = data.__typename;
		delete data.__typename;
		Object.defineProperty(data, "__typename", {value: typeName}); // defining it this way, makes the property non-enumerable
	}

	if (Object.keys(data).includes("_")) {
		const typeName = data._;
		delete data._;
		Object.defineProperty(data, "_", {value: typeName}); // defining it this way, makes the property non-enumerable
	}

	// remove fields that are null; this works more smoothly with return-data schemas (where its easy to mark field as optional/omittable, but not as easy to mark as nullable)
	for (const key of Object.keys(data)) {
		if (data[key] == null) {
			delete data[key];
		}
	}

	return data;
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
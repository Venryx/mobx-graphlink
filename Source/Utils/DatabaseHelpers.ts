import {DeepSet, IsNumberString, Assert, StringCE, Clone, ObjectCE, ArrayCE, GetTreeNodesInObjTree, E, CE, StartDownload, IsObject} from "js-vextensions";
import u from "updeep";
import {MaybeLog_Base} from "./General.js";
import {GraphOptions, SplitStringBySlash_Cached} from "../index.js";
import {defaultGraphOptions} from "../Graphlink.js";

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

export function ConfirmDBUpdatesAreValid(dbUpdates: Object) {
	// confirm that all db-updates' paths were constructed correctly (using dbp), then remove the marker/prefix (before actual application)
	const dbUpdates_pairs = ObjectCE(dbUpdates).Pairs();
	for (const pair of dbUpdates_pairs) {
		Assert(pair.key.startsWith(dbpPrefix), `A db-path was apparently not constructed using the dbp template-literal function: ${pair.key}`);
		delete dbUpdates[pair.key];
		dbUpdates[pair.key.slice(dbpPrefix.length)] = pair.value;
		/*pair.key = pair.key.slice(dbpPrefix.length);
		dbUpdates[pair.key] = pair.value;*/
	}
}
export async function ApplyDBUpdates(options: Partial<GraphOptions & ApplyDBUpdates_Options>, dbUpdates: Object, rootPath_override?: string) {
	const opt = E(defaultGraphOptions, ApplyDBUpdates_Options.default, options) as GraphOptions & ApplyDBUpdates_Options;
	dbUpdates = FinalizeDBUpdates(options, dbUpdates, rootPath_override);

	ConfirmDBUpdatesAreValid(dbUpdates);
	const dbUpdates_pairs = ObjectCE(dbUpdates).Pairs();

	MaybeLog_Base(a=>a.commands, l=>l(`Applying db-updates...`));
	//await ApplyDBUpdates_Base(opt, dbUpdates_chunk, rootPath_override);
	// todo
}

export function ApplyDBUpdates_Local(dbData: any, dbUpdates: Object) {
	ConfirmDBUpdatesAreValid(dbUpdates);

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

export const dbpPrefix = "[@dbp:]";
/** When creating db-path strings, always create it using this function to construct the template-literal.
 * It protects from typos like: dbp(\`...\`) (do this instead: dbp\`...\`) */
export function dbp(strings: TemplateStringsArray, ...vars: string[]) {
	Assert(`The "dbp" template-literal function requires at least one variable, to protect from typos like: dbp(\`...\`) (do this instead: dbp\`...\`)`);
	for (const expression of vars) {
		Assert(typeof expression == "string", "DB-path-segment variables must be strings.");
		Assert(/^([A-Za-z0-9_-]+)$/.test(expression), `DB-path-segment variables must only contain alphanumeric, "_", or "-" characters.`);
	}
	// now just default template literal functionality
	let result = dbpPrefix;
	strings.forEach((str, i) => {
		result += `${str}${i == strings.length - 1 ? "" : vars[i]}`;
	});
	return result;
}
import {DeepSet, IsNumberString, Assert, StringCE, Clone, ObjectCE, ArrayCE, GetTreeNodesInObjTree, E, CE, StartDownload, IsObject} from "js-vextensions";
import u from "updeep";
import {MaybeLog_Base} from "./General";
import {FireOptions, SplitStringBySlash_Cached} from "..";
import {defaultFireOptions} from "../Graphlink";
import firebase from "firebase";
import {GetPathParts} from "./PathHelpers";
import {nil} from "./Nil";

export function IsAuthValid(auth) {
	return auth && !auth.isEmpty;
}

/**
Applies normalization of an object-tree to match how it would be stored (and thus returned) by Firestore.

Currently, this consists of: sorting keys in alphabetical order.
*/
export function WithFirestoreNormalization(obj: any) {
	if (obj == null) return obj;
	const result = Clone(obj);
	for (const treeNode of GetTreeNodesInObjTree(result)) {
		if (IsObject(treeNode.Value) && treeNode.Value != null) {
			const oldProps = CE(treeNode.Value).Pairs();
			for (const prop of oldProps) {
				delete treeNode.Value[prop.key];
			}
			// re-add props in alphabetical order (to match with ordering applied by firestore)
			for (const prop of CE(oldProps).OrderBy(a=>a.key)) {
				treeNode.Value[prop.key] = prop.value;
			}
		}
	}
	return result;
}

/* Object.prototype._AddFunction_Inline = function DBRef(path = "", inVersionRoot = true) {
	const finalPath = DBPath(path, inVersionRoot);
	return this.ref(finalPath);
}; */

export function ProcessDBData(data, addHelpers: boolean, rootKey = "_root") {
	if (data == null) return;
	var treeNodes = GetTreeNodesInObjTree(data, true);
	for (const treeNode of treeNodes) {
		if (treeNode.Value == null) continue;

		// turn the should-not-have-been-array arrays (the ones without a "0" property) into objects
		//if (standardizeForm && treeNode.Value instanceof Array && treeNode.Value[0] === undefined) {

		// turn the should-not-have-been-array arrays (the ones with non-number property) into objects
		/*if (standardizeForm && treeNode.Value instanceof Array && ArrayCE(ObjectCE(treeNode.Value).VKeys(true)).Any(a=>!IsNumberString(a))) {
			// if changing root, we have to actually modify the prototype of the passed-in "data" object
			/*if (treeNode.Value == data) {
				Object.setPrototypeOf(data, Object.getPrototypeOf({}));
				for (var key of Object.keys(data)) {
					if (data[key] === undefined)
						delete data[key];
				}
				continue;
			}*#/

			const valueAsObject = Object.assign({}, treeNode.Value) as any;
			for (const key in valueAsObject) {
				// if fake array-item added by Firebase/js (just so the array would have no holes), remove it
				//if (valueAsObject[key] == null)
				if (valueAsObject[key] === nil) { delete valueAsObject[key]; }
			}

			if (treeNode.Value == data) treeNode.obj[treeNode.prop] = valueAsObject; // if changing root, we need to modify wrapper.data
			else DeepSet(data, treeNode.PathStr, valueAsObject); // else, we need to use deep-set, because ancestors may have already changed during this transform/processing
		}

		// turn the should-have-been-array objects (the ones with a "0" property) into arrays
		if (standardizeForm && typeof treeNode.Value == "object" && !(treeNode.Value instanceof Array) && treeNode.Value[0] !== nil) {
			// if changing root, we have to actually modify the prototype of the passed-in "data" object
			/*if (treeNode.Value == data) {
				Object.setPrototypeOf(data, Object.getPrototypeOf([]));
				data.length = data.VKeys(true).filter(a=>IsNumberString(a));
				continue;
			}*#/

			const valueAsArray = Object.assign([], treeNode.Value) as any;

			if (treeNode.Value == data) treeNode.obj[treeNode.prop] = valueAsArray; // if changing root, we need to modify wrapper.data
			else DeepSet(data, treeNode.PathStr, valueAsArray); // else, we need to use deep-set, because ancestors may have already changed during this transform/processing
		}*/

		// add special _key or _id prop
		if (addHelpers && typeof treeNode.Value == "object") {
			const key = treeNode.prop == "_root" ? rootKey : treeNode.prop;
			if (IsNumberString(key)) {
				//treeNode.Value._id = parseInt(key);
				//treeNode.Value._Set("_id", parseInt(key));
				Object.defineProperty(treeNode.Value, "_id", {enumerable: false, value: parseInt(key)});
			}

			// actually, always set "_key" (in case it's a "_key" that also happens to look like an "_id"/integer)
			//else {
			//treeNode.Value._key = key;
			//treeNode.Value._Set("_key", key);
			Object.defineProperty(treeNode.Value, "_key", {enumerable: false, value: key});
		}
	}
	return treeNodes[0].Value; // get possibly-modified wrapper.data
}

// these shouldn't be needed anymore, since _key and _id are stored as non-enumerable props now
/* const helperProps = ["_key", "_id"];
/** Note: this mutates the original object. *#/
export function RemoveHelpers(data) {
	var treeNodes = GetTreeNodesInObjTree(data, true);
	for (const treeNode of treeNodes) {
		if (helperProps.Contains(treeNode.prop)) { delete treeNode.obj[treeNode.prop]; }
	}
	return data;
}
export function WithoutHelpers(data) {
	return RemoveHelpers(Clone(data));
} */

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

//export const DBValueWrapper_classSymbol = Symbol("DBValueWrapper_classSymbol");
export class DBValueWrapper {
	//[DBValueWrapper_classSymbol] = true;
	value: any;
	merge = false;
}
/*export function IsDBValueWrapper(val: any) {
	//return val[DBValueWrapper_classSymbol] === true;
	return val instanceof DBValueWrapper;
}*/
export function WrapDBValue(value: any, otherFlags: Partial<Omit<DBValueWrapper, "value">>) {
	let result = new DBValueWrapper();
	result.value = value;
	CE(result).VSet(otherFlags);
	return result;
}

export function ConvertDBUpdatesToBatch(options: Partial<FireOptions>, dbUpdates: Object) {
	const opt = E(defaultFireOptions, options) as FireOptions;
	const updateEntries = Object.entries(dbUpdates);
	Assert(updateEntries.length <= maxDBUpdatesPerBatch, `Cannot have more than ${maxDBUpdatesPerBatch} db-updates per batch.`);

	const batch = opt.fire.subs.firestoreDB.batch();
	for (let [path, value] of updateEntries) {
		let [docPath, fieldPathInDoc] = GetPathParts(path, true);

		let useMerge = false;
		if (value instanceof DBValueWrapper) {
			let wrapper = value;
			if (wrapper.merge) useMerge = true;
			value = wrapper.value;
		}
		value = Clone(value); // picky firestore library demands "simple JSON objects"

		// [fieldPathInDoc, value] = FixSettingPrimitiveValueDirectly(fieldPathInDoc, value);

		const docRef = opt.fire.subs.firestoreDB.doc(docPath);
		if (fieldPathInDoc) {
			value = value != null ? value : firebase.firestore.FieldValue.delete();

			if (useMerge) {
				// Set-with-merge differs from update in that:
				// 1) It works even if the document doesn't exist yet.
				// 2) This doesn't remove existing children entries: [`nodes/${nodeID}/.children`]: {newChild: true}
				const nestedSetHelper = {};
				DeepSet(nestedSetHelper, fieldPathInDoc, value, ".", true);
				batch.set(docRef, nestedSetHelper, {merge: true});
			} else {
				batch.update(docRef, {[fieldPathInDoc]: value});
			}
		} else {
			Assert(!useMerge, "Can only use merge flag for in-document paths.");
			if (value) {
				batch.set(docRef, value);
			} else {
				batch.delete(docRef);
			}
		}
		/* let path_final = DBPath(path);
		let dbRef_parent = firestoreDB.doc(path_final.split("/").slice(0, -1).join("/"));
		let value_final = Clone(value); // clone value, since update() rejects values with a prototype/type
		batch.update(dbRef_parent, {[path_final.split("/").Last()]: value_final}); */
	}
	return batch;
}

export const maxDBUpdatesPerBatch = 500;
export class ApplyDBUpdates_Options {
	static default = new ApplyDBUpdates_Options();
	updatesPerChunk = maxDBUpdatesPerBatch;
}

export function FinalizeDBUpdates(options: Partial<FireOptions & ApplyDBUpdates_Options>, dbUpdates: Object, rootPath_override?: string) {
	const opt = E(defaultFireOptions, ApplyDBUpdates_Options.default, options) as FireOptions & ApplyDBUpdates_Options;
	//dbUpdates = WithoutHelpers(Clone(dbUpdates));
	//dbUpdates = Clone(dbUpdates);
	dbUpdates = {...dbUpdates}; // shallow clone, so we preserve DBValueWrappers in entries
	let rootPath = rootPath_override ?? opt.fire.rootPath;
	if (rootPath != null && rootPath != "") {
		//for (const {key: localPath, value} of ObjectCE.Pairs(dbUpdates)) {
		for (const {key: localPath, value} of ObjectCE(dbUpdates).Pairs()) {
			dbUpdates[`${rootPath}/${localPath}`] = value;
			delete dbUpdates[localPath];
		}
	}
	return dbUpdates;
}

export async function ApplyDBUpdates(options: Partial<FireOptions & ApplyDBUpdates_Options>, dbUpdates: Object, rootPath_override?: string) {
	const opt = E(defaultFireOptions, ApplyDBUpdates_Options.default, options) as FireOptions & ApplyDBUpdates_Options;
	dbUpdates = FinalizeDBUpdates(options, dbUpdates, rootPath_override);

	// await firestoreDB.runTransaction(async batch=> {

	const dbUpdates_pairs = ObjectCE(dbUpdates).Pairs();
	const dbUpdates_pairs_chunks = [] as any[];
	for (let offset = 0; offset < dbUpdates_pairs.length; offset += opt.updatesPerChunk) {
		const chunk = dbUpdates_pairs.slice(offset, offset + opt.updatesPerChunk);
		dbUpdates_pairs_chunks.push(chunk);
	}

	for (const [index, dbUpdates_pairs_chunk] of dbUpdates_pairs_chunks.entries()) {
		const dbUpdates_chunk = dbUpdates_pairs_chunk.ToMap(a=>a.key, a=>a.value);
		if (dbUpdates_pairs_chunks.length > 1) {
			MaybeLog_Base(a=>a.commands, l=>l(`Applying db-updates chunk #${index + 1} of ${dbUpdates_pairs_chunks.length}...`));
		}
		//await ApplyDBUpdates_Base(opt, dbUpdates_chunk, rootPath_override);
		let batch = ConvertDBUpdatesToBatch(opt, dbUpdates_chunk);
		await batch.commit();
	}
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

// if performing db-changes from console, call this just before ApplyDBUpdates, to back-up/download data at the given paths first
export type QuickBackup = {[key: string]: {oldData: any, newData: any}};
export async function MakeQuickBackupForDBUpdates(options: Partial<FireOptions & ApplyDBUpdates_Options>, dbUpdates: Object, rootPath_override?: string, log = true, download = true) {
	const opt = E(defaultFireOptions, ApplyDBUpdates_Options.default, options) as FireOptions & ApplyDBUpdates_Options;
	dbUpdates = FinalizeDBUpdates(options, dbUpdates, rootPath_override);
	
	const newDocValues_pairs = CE(dbUpdates).Pairs();
	const oldDocValues = await Promise.all(newDocValues_pairs.map(pair=> {
		let [docPath, fieldPathInDoc] = GetPathParts(pair.key, true);
		let docRef = opt.fire.subs.firestoreDB.doc(docPath) as firebase.firestore.DocumentReference;
		return docRef.get().then(data=>data.data());
	}));

	/*const docValues_map = CE(docValues).ToMap((a, index)=>dbUpdateEntries[index].key, a=>a);
	const backupData = {
		oldValues: docValues_map,
		newValues: docValues_map,
	};*/

	const quickBackup: QuickBackup = CE(newDocValues_pairs).ToMap(pair=>pair.key, pair=>({
		oldData: oldDocValues[pair.index],
		newData: pair.value,
	}));

	const quickBackupJSON = JSON.stringify(quickBackup);
	if (log) {
		console.log("QuickBackup:", quickBackup);
	}
	if (download) {
		StartDownload(new Blob([quickBackupJSON]), "QuickBackup.json");
	}
	return quickBackup;
}
/**
Restores the old-values for the paths listed in the quick-backup.
Note: Uses the *absolute paths* listed; to restore to a different version-root, transform the quick-backup data.
*/
export async function RestoreQuickBackup(options: Partial<FireOptions & ApplyDBUpdates_Options>, quickBackup: QuickBackup) {
	const oldDataAsDBUpdates = CE(CE(quickBackup).Pairs()).ToMap(a=>a.key, a=>a.value.oldData);
	console.log("OldDataAsDBUpdates:", oldDataAsDBUpdates);
	//await ApplyDBUpdates(options, oldDataAsDBUpdates, rootPath_override);
	await ApplyDBUpdates(options, oldDataAsDBUpdates, "");
	console.log("Restored quick-backup. (Note: Used the *absolute paths* listed; to restore to a different version-root, transform the quick-backup data.)");
}
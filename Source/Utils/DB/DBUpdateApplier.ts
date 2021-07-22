import {Assert, CE, GetTreeNodesInObjTree} from "js-vextensions";
import type Knex from "knex";
import u from "updeep";
import {GetFieldDBInit, GetMGLClass, mglClasses, TableNameToDocSchemaName} from "../../Extensions/Decorators.js";
import {GetSchemaJSON, NewSchema} from "../../Extensions/JSONSchemaHelpers.js";
import {defaultGraphOptions} from "../../Graphlink.js";
import {MaybeLog_Base} from "../General/General.js";
import {DBPPath, dbpPrefix} from "./DBPaths.js";
import {DBUpdate} from "./DBUpdate.js";
import {SimplifyDBUpdates} from "./DBUpdateSimplifier.js";

export function FinalizeDBUpdates(dbUpdates: DBUpdate[], simplifyDBUpdates = true) {
	dbUpdates = dbUpdates.slice(); // shallow clone, so we preserve DBValueWrappers in entries
	
	// confirm that all db-updates' paths were constructed using dbp, then remove the marker/prefix
	for (const update of dbUpdates) {
		Assert(update.path.startsWith(dbpPrefix), `A db-path was apparently not constructed using the dbp template-literal function: ${update.path}`);
		update.path = update.path.slice(dbpPrefix.length) as DBPPath; // if a string *was* a valid DBPPath (ie. injection-safe, because vars/slots were escaped), then it will remain so after we remove the prefix
	}

	for (const update of dbUpdates) AssertDBUpdateIsValid(update);
	if (simplifyDBUpdates) {
		dbUpdates = SimplifyDBUpdates(dbUpdates);
	}
	for (const update of dbUpdates) AssertDBUpdateIsValid(update);

	return dbUpdates;
}
export function AssertDBUpdateIsValid(update: DBUpdate) {
	Assert(CE(update.PathSegments.length).IsBetween(2, 3), `DB-updates must set the value of either a whole document/row, or a direct-child field/column.${""
		} For deep updates, apply changes locally, then submit the entire new document or field/column.`);
	if (update.PathSegments.length == 3) {
		Assert(update.PathSegments[2].startsWith(".") && CE(update.PathSegments[2]).Matches(".").length == 1, `DB-updates for a specific field/column must start the field/column name with the "." character.`);
	}
}

// tries to approximate the application of db-updates, to a local copy of part of the db's data
export function ApplyDBUpdates_Local(dbData: any, dbUpdates: DBUpdate[], simplifyDBUpdates = true) {
	dbUpdates = FinalizeDBUpdates(dbUpdates, simplifyDBUpdates);

	let result = dbData;
	for (const update of dbUpdates) {
		if (update.value != null) {
			result = u.updateIn(update.path.replace(/\//g, "."), u.constant(update.value), result);
		} else {
			result = u.updateIn(update.path.split("/").slice(0, -1).join("."), u.omit(update.path.split("/").slice(-1)), result);
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

export async function ApplyDBUpdates(dbUpdates: DBUpdate[], simplifyDBUpdates = true) {
	dbUpdates = FinalizeDBUpdates(dbUpdates, simplifyDBUpdates);

	// prepare pg-client and knex
	const {pgClient, knexModule} = defaultGraphOptions.graph.subs;
	Assert(pgClient != null, "pgClient must be supplied to Graphlink instance to be able to call ApplyDBUpdates. (only possible from db-server instance)")
	Assert(knexModule != null, "knexModule (the export of knex npm-module) must be supplied to Graphlink instance to be able to call ApplyDBUpdates. (only possible from db-server instance)")
	type KnexInstance = ReturnType<typeof Knex>;
	const knex_raw: KnexInstance = pgClient!["_knex"] ?? (pgClient!["_knex"] = knexModule!({client: "pg"}));
	/*const knex: typeof knex_raw = ((...args)=>{
		return knex_raw(...args).connection(pgClient); // add pgClient as connection every time
	}) as any;
	// add other fields/methods of "knex_raw" onto the "knex" wrapper
	for (const key of Object.getOwnPropertyNames(knex_raw)) { // "Object.keys" excludes some needed fields, like "transaction"
		//if (key == "length" || key == "name") continue;
		if (key in knex) continue;
		knex[key] = knex_raw[key];
	}
	Object.setPrototypeOf(knex, Object.getPrototypeOf(knex_raw)); // also make sure prototype is the same (not sure if needed)*/

	// prepare transaction
	MaybeLog_Base(a=>a.commands, l=>l(`Applying db-updates...`));
	await knex_raw.transaction(async knexTx=>{
		// add db-commands to transaction
		for (const update of dbUpdates) {
			AssertDBUpdateIsValid(update);
			const tableName = update.PathSegments[0];
			const docSchemaName = TableNameToDocSchemaName(tableName);
			const class_ = GetMGLClass(docSchemaName);
			Assert(class_ != null, `Could not find class for table: ${tableName} (tried finding by name: "${docSchemaName}")`);
			const docSchema = GetSchemaJSON(docSchemaName);
			Assert(docSchema != null, `Could not find schema for table: ${tableName} (tried finding by name: "${docSchemaName}")`);
			Assert(docSchema.properties != null, `Schema "${docSchemaName}" has no properties, which is invalid for a document/row type.`);
			const docID = update.PathSegments[1];
			
			const FinalizeFieldValue = (rawVal: any, fieldName: string)=>{
				let result = rawVal;
				// if db-type for a field is "json"/"jsonb", make sure that the value is stringified
				const fieldDBInitFunc = GetFieldDBInit(class_, fieldName);
				Assert(fieldDBInitFunc != null, `Could not find db-init-func for field "${fieldName}" on class "${class_.name}".`);
				if (fieldDBInitFunc.toString().includes(".json(") || fieldDBInitFunc.toString().includes(".jsonb(")) {
					result = typeof result == "string" || result == null ? result : JSON.stringify(result);
				}
				return result;
			};

			const isSet = update.PathSegments.length == 2 && update.value != null;
			const isDelete = update.PathSegments.length == 2 && update.value == null;
			if (isSet) {
				//const result = await knex(tableName).where({id: docID}).first().insert(update.value);
				const docValue_final = {...update.value};
				for (const column of Object.keys(docSchema.properties)) {
					// make sure every column/field has a value; this way, the "onConflict, merge" behavior is the same as "set"
					if (!(column in docValue_final)) {
						docValue_final[column] = null;
					}
					docValue_final[column] = FinalizeFieldValue(docValue_final[column], column);
				}
				// if db-type is "json"/"jsonb", convert value to string before actual insertion
				
				const [row] = await knexTx(tableName).insert(docValue_final)
					.onConflict("id").merge() // if row already exists, set it to the newly-passed data
					.returning("*");
			} else if (isDelete) {
				const [row] = await knexTx(tableName).where({id: docID}).delete().returning("*");
			} else { // else, must be within-doc update
				const fieldName = update.PathSegments[2].slice(1);
				const [row] = await knexTx(tableName).where({id: docID}).update({
					[fieldName]: FinalizeFieldValue(update.value, fieldName),
				}).returning("*");
			}
		}

		// commit transaction
		console.log("Committing transaction...");
		// transaction is automatically committed after the promise for this function resolves (and if promise rejects, transaction is automatically rolled back)
		//await knexTx.commit();
	}, {connection: pgClient});
}
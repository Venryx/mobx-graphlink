import { Assert, CE, GetTreeNodesInObjTree } from "js-vextensions";
import u from "updeep";
import { GetFieldDBInit, GetMGLClass, TableNameToDocSchemaName } from "../../Extensions/Decorators.js";
import { GetSchemaJSON } from "../../Extensions/JSONSchemaHelpers.js";
import { defaultGraphRefs } from "../../Graphlink.js";
import { MaybeLog_Base } from "../General/General.js";
import { dbpPrefix } from "./DBPaths.js";
import { SimplifyDBUpdates } from "./DBUpdateSimplifier.js";
export function FinalizeDBUpdates(dbUpdates, simplifyDBUpdates = true) {
    dbUpdates = dbUpdates.slice(); // shallow clone, so we preserve DBValueWrappers in entries
    // confirm that all db-updates' paths were constructed using dbp, then remove the marker/prefix
    for (const update of dbUpdates) {
        Assert(update.path.startsWith(dbpPrefix), `A db-path was apparently not constructed using the dbp template-literal function: ${update.path}`);
        update.path = update.path.slice(dbpPrefix.length); // if a string *was* a valid DBPPath (ie. injection-safe, because vars/slots were escaped), then it will remain so after we remove the prefix
    }
    for (const update of dbUpdates)
        AssertDBUpdateIsValid(update);
    if (simplifyDBUpdates) {
        dbUpdates = SimplifyDBUpdates(dbUpdates);
    }
    for (const update of dbUpdates)
        AssertDBUpdateIsValid(update);
    return dbUpdates;
}
/** Checks that various properties of the db-update are valid. (only checks properties discernable without referencing update-object-external data like schemas) */
export function AssertDBUpdateIsValid(update) {
    const pathSegments = update.PathSegments;
    const pathSegments_plain = update.PathSegments_Plain;
    Assert(pathSegments.length >= 2, "There must be at least two path-segments. (the table name, and the row/doc id)");
    /*Assert(CE(update.PathSegments.length).IsBetween(2, 3), `DB-updates must set the value of either a whole document/row, or a direct-child field/column.${""
        } For deep updates, apply changes locally, then submit the entire new document or field/column.`);*/
    if (update.PathSegments.length >= 3) {
        const hasOneDotAtStart = (str) => str.startsWith(".") && CE(str).Matches(".").length == 1;
        Assert(hasOneDotAtStart(pathSegments[2]), `For db-updates targeting a specific field/cell, the field/cell path-segment must start with the "." character.`);
        if (pathSegments.length >= 4) {
            Assert(pathSegments.slice(3).every(a => hasOneDotAtStart(a)), `For db-updates targeting a specific path within a JSONB field/cell, the cell-internal path-segments must start with the "." character.`);
        }
    }
    // sanity checks
    const plainStrRegex = /^[a-zA-Z0-9_-]+$/;
    Assert(pathSegments_plain.every(a => plainStrRegex.test(a)), `Path-segment characters must be alphanumerics, underscores, or hyphens. Got:${pathSegments_plain.join(",")}`);
}
// tries to approximate the application of db-updates, to a local copy of part of the db's data
export function ApplyDBUpdates_Local(dbData, dbUpdates, simplifyDBUpdates = true) {
    dbUpdates = FinalizeDBUpdates(dbUpdates, simplifyDBUpdates);
    let result = dbData;
    for (const update of dbUpdates) {
        if (update.value != null) {
            result = u.updateIn(update.path.replace(/\//g, "."), u.constant(update.value), result);
        }
        else {
            result = u.updateIn(update.path.split("/").slice(0, -1).join("."), u.omit(update.path.split("/").slice(-1)), result);
        }
    }
    // during applying, we consider values of "null" to mean the entry should be deleted, so do the same here
    const nodes = GetTreeNodesInObjTree(result, true);
    let emptyNodes = nodes.filter(a => a.Value == null);
    for (const node of emptyNodes) {
        delete node.obj[node.prop];
    }
    return result;
}
export async function ApplyDBUpdates(dbUpdates, simplifyDBUpdates = true, deferConstraints = false) {
    var _a;
    dbUpdates = FinalizeDBUpdates(dbUpdates, simplifyDBUpdates);
    // prepare pg-client and knex
    const { pgPool, knexModule } = defaultGraphRefs.graph.subs;
    Assert(pgPool != null, "pgPool must be supplied to Graphlink instance to be able to call ApplyDBUpdates. (only possible from db-server instance)");
    Assert(knexModule != null, "knexModule (the export of knex npm-module) must be supplied to Graphlink instance to be able to call ApplyDBUpdates. (only possible from db-server instance)");
    const knex_raw = (_a = pgPool["_knex"]) !== null && _a !== void 0 ? _a : (pgPool["_knex"] = knexModule({ client: "pg" }));
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
    MaybeLog_Base(a => a.commands, l => l(`Applying db-updates...`));
    await knex_raw.transaction(async (knexTx) => {
        var _a, _b;
        if (deferConstraints) {
            // needed for some cases, eg. adding "node" and "nodeRevision", with both having fk-refs to each other
            await knexTx.raw("SET CONSTRAINTS ALL DEFERRED;");
        }
        // add db-commands to transaction
        for (const update of dbUpdates) {
            AssertDBUpdateIsValid(update);
            // the dots were only needed as a sanity checks, so now that those checks are done, simplify by removing the dots
            const pathSegments_plain = update.PathSegments_Plain;
            const tableName = pathSegments_plain[0];
            const docSchemaName = TableNameToDocSchemaName(tableName);
            const class_ = GetMGLClass(docSchemaName);
            Assert(class_ != null, `Could not find class for table: ${tableName} (tried finding by name: "${docSchemaName}")`);
            const docSchema = GetSchemaJSON(docSchemaName);
            Assert(docSchema != null, `Could not find schema for table: ${tableName} (tried finding by name: "${docSchemaName}")`);
            Assert(docSchema.properties != null, `Schema "${docSchemaName}" has no properties, which is invalid for a document/row type.`);
            const docID = pathSegments_plain[1];
            const FinalizeFieldValue = (rawVal, fieldName) => {
                let result = rawVal;
                // if db-type for a field is "json"/"jsonb", make sure that the value is stringified
                const fieldDBInitFunc = GetFieldDBInit(class_, fieldName);
                Assert(fieldDBInitFunc != null, `Could not find db-init-func for field "${fieldName}" on class "${class_.name}".`);
                if (fieldDBInitFunc.toString().includes(".json(") || fieldDBInitFunc.toString().includes(".jsonb(")) {
                    result = typeof result == "string" || result == null ? result : JSON.stringify(result);
                }
                return result;
            };
            const isSet = update.value != null;
            const isDelete = update.value == null;
            const targetingRow = pathSegments_plain.length == 2;
            const targetingCell = pathSegments_plain.length == 3;
            const targetingJSONBPath = pathSegments_plain.length > 3;
            let queryPromise;
            if (targetingRow) {
                if (isSet) {
                    //const result = await knex(tableName).where({id: docID}).first().insert(update.value);
                    const docValue_final = { ...update.value };
                    for (const column of Object.keys(docSchema.properties)) {
                        const columnSchema = docSchema.properties[column];
                        // special key for saying "db writes this field automatically, don't try to specify it" (eg. tsvector column calculated from text/jsonb field)
                        if (columnSchema["$noWrite"] || ((_b = (_a = columnSchema["anyOf"]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b["$noWrite"]))
                            continue;
                        // make sure every column/field has a value; this way, the "onConflict, merge" behavior is the same as "set"
                        if (!(column in docValue_final)) {
                            docValue_final[column] = null;
                        }
                        docValue_final[column] = FinalizeFieldValue(docValue_final[column], column);
                    }
                    // if db-type is "json"/"jsonb", convert value to string before actual insertion
                    queryPromise = knexTx(tableName).insert(docValue_final)
                        .onConflict("id").merge() // if row already exists, set it to the newly-passed data
                        .returning("*");
                }
                else if (isDelete) {
                    queryPromise = knexTx(tableName).where({ id: docID }).delete().returning("*");
                }
            }
            else if (targetingCell) {
                // todo: make sure this handles deletes correctly
                const fieldName = pathSegments_plain[2];
                queryPromise = knexTx(tableName).where({ id: docID }).update({
                    [fieldName]: FinalizeFieldValue(update.value, fieldName),
                }).returning("*");
            }
            else if (targetingJSONBPath) {
                const jsonbFieldName = pathSegments_plain[2];
                const pathSegmentsInJSONB = pathSegments_plain.slice(3);
                if (isSet) {
                    //const value_final = FinalizeFieldValue(update.value, fieldName);
                    const value_final = JSON.stringify(update.value); // the value for this code-path will always be within a JSONB cell, so just stringify it (rather than calling FinalizeFieldValue)
                    // simple approach, using jsonb_set (commented, because it doesn't work for deeply-nested fields, where more than just the final field is missing)
                    /*await CE(knexTx(tableName).where({id: docID}).update({
                        [jsonbFieldName]: knex_raw.raw(`jsonb_set(??, '{${pathPlaceholdersStr}}', ?)`, [jsonbFieldName, ...pathSegmentsInJSONB, value_final]),
                    }).returning("*")).VAct(a=>console.log("SQL:", a.toSQL()));*/
                    // approach for safely setting the value of a "deeply nested" in-jsonb field (see here: https://stackoverflow.com/a/69534368)
                    let jsonbSet_startLines = [];
                    let jsonbSet_endLine = "";
                    let jsonbSet_values = [];
                    for (const [i, pathSegment] of pathSegmentsInJSONB.entries()) {
                        const priorPathSegments = [jsonbFieldName, ...pathSegmentsInJSONB.slice(0, i)];
                        const priorPathSegments_quoted = priorPathSegments.map((segment, segmentIndex) => {
                            // the name of the jsonb-field itself must use double-quotes; the fields *within* the jsonb-data must use single-quotes
                            return segmentIndex == 0 ? `"${segment}"` : `'${segment}'`;
                        });
                        const priorPathStr = priorPathSegments_quoted.join("->");
                        jsonbSet_startLines.push(`jsonb_set(COALESCE(${priorPathStr}, '{}'), '{"${pathSegment}"}',`);
                        if (i == pathSegmentsInJSONB.length - 1) {
                            jsonbSet_startLines.push("?");
                            jsonbSet_values.push(value_final);
                        }
                        jsonbSet_endLine += `)`;
                    }
                    const jsonbSet_str = [...jsonbSet_startLines, jsonbSet_endLine].join("\n");
                    queryPromise = knexTx(tableName).where({ id: docID }).update({
                        [jsonbFieldName]: knex_raw.raw(jsonbSet_str, jsonbSet_values),
                    }).returning("*");
                }
                else if (isDelete) {
                    const pathSegmentsInJSONB_quoted = pathSegmentsInJSONB.map(a => `'${a}'`);
                    queryPromise = knexTx(tableName).where({ id: docID }).update({
                        [jsonbFieldName]: knex_raw.raw(`"${jsonbFieldName}" #- array[${pathSegmentsInJSONB_quoted}]`),
                    }).returning("*");
                }
            }
            if (queryPromise != null) {
                console.log("Applying query SQL. @pathSegments_plain:", pathSegments_plain, "@updateValue:", update.value, "@sql:", queryPromise.toSQL());
                const [row] = await queryPromise;
            }
        }
        // commit transaction
        console.log("Committing transaction...");
        // transaction is automatically committed after the promise for this function resolves (and if promise rejects, transaction is automatically rolled back)
        //await knexTx.commit();
    }, { connection: pgPool });
}

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Assert, CE, GetTreeNodesInObjTree } from "js-vextensions";
import Knex from "knex";
import u from "updeep";
import { TableNameToDocSchemaName } from "../../Extensions/Decorators.js";
import { Schema } from "../../Extensions/SchemaHelpers.js";
import { defaultGraphOptions } from "../../Graphlink.js";
import { MaybeLog_Base } from "../General/General.js";
import { dbpPrefix } from "./DBPaths.js";
import { SimplifyDBUpdates } from "./DBUpdateSimplifier.js";
export function FinalizeDBUpdates(dbUpdates, simplifyDBUpdates = true) {
    dbUpdates = dbUpdates.slice(); // shallow clone, so we preserve DBValueWrappers in entries
    // confirm that all db-updates' paths were constructed using dbp, then remove the marker/prefix
    for (const update of dbUpdates) {
        Assert(update.path.startsWith(dbpPrefix), `A db-path was apparently not constructed using the dbp template-literal function: ${update.path}`);
        update.path = update.path.slice(dbpPrefix.length);
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
export function AssertDBUpdateIsValid(update) {
    Assert(CE(update.PathSegments.length).IsBetween(2, 3), `DB-updates must set the value of either a whole document/row, or a direct-child field/column.${""} For deep updates, apply changes locally, then submit the entire new document or field/column.`);
    if (update.PathSegments.length == 3) {
        Assert(update.PathSegments[3].startsWith(".") && CE(update.PathSegments[3]).Matches(".").length == 1, `DB-updates for a specific field/column must start the field/column name with the "." character.`);
    }
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
    // firebase deletes becoming-empty collections/documents (and we pre-process-delete becoming-empty fields), so we do the same here
    const nodes = GetTreeNodesInObjTree(result, true);
    let emptyNodes;
    do {
        emptyNodes = nodes.filter(a => typeof a.Value === "object" && (a.Value == null || a.Value.VKeys(true).length === 0));
        for (const node of emptyNodes) {
            delete node.obj[node.prop];
        }
    } while (emptyNodes.length);
    return result;
}
export function ApplyDBUpdates(dbUpdates, simplifyDBUpdates = true) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        dbUpdates = FinalizeDBUpdates(dbUpdates, simplifyDBUpdates);
        // prepare pg-client and knex
        const pgClient = defaultGraphOptions.graph.subs.pgClient;
        Assert(pgClient != null, "pgClient must be supplied to Graphlink instance to be able to call ApplyDBUpdates. (only possible from db-server instance)");
        const knex_raw = (_a = pgClient["_knex"]) !== null && _a !== void 0 ? _a : (pgClient["_knex"] = Knex({ client: "pg" }));
        const knex = Object.assign((...args) => {
            return knex_raw(...args).connection(pgClient); // add pgClient as connection every time
        }, knex_raw); // add other fields/methods of "knex_raw" onto the "knex" wrapper
        // prepare transaction
        MaybeLog_Base(a => a.commands, l => l(`Applying db-updates...`));
        const transaction = yield knex.transaction();
        // add db-commands to transaction
        for (const update of dbUpdates) {
            AssertDBUpdateIsValid(update);
            const tableName = update.PathSegments[0];
            const docSchema = Schema(TableNameToDocSchemaName(tableName));
            const docID = update.PathSegments[1];
            const isSet = update.PathSegments.length == 2 && update.value != null;
            const isDelete = update.PathSegments.length == 2 && update.value == null;
            if (isSet) {
                //const result = await knex(tableName).where({id: docID}).first().insert(update.value);
                const docValue_final = Object.assign({}, update.value);
                // make sure every column/field has a value; this way, the "onConflict, merge" behavior is the same as "set"
                for (const column of Object.keys(docSchema.properties)) {
                    if (!(column in docValue_final)) {
                        docValue_final[column] = null;
                    }
                }
                const [row] = yield knex(tableName).insert(docValue_final)
                    .onConflict("id").merge() // if row already exists, set it to the newly-passed data
                    .returning("*");
            }
            else if (isDelete) {
                const [row] = yield knex(tableName).where({ id: docID }).delete().returning("*");
            }
            else {
                const fieldName = update.PathSegments[2].slice(1);
                const [row] = yield knex(tableName).where({ id: docID }).update({
                    [fieldName]: update.value,
                }).returning("*");
            }
        }
        // commit transaction
        console.log("Committing transaction...");
        yield transaction.commit();
    });
}
